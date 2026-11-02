import type { McpServer } from "@modelcontextprotocol/server";
import { fitailyGet, fitailySend } from "../api/fitaily-client";
import type { McpAuth } from "../auth/verify";
import { requireScope } from "../auth/verify";
import {
  ListDietPlansInput,
  GetDietPlanInput,
  GenerateDietPlanInput,
  ActivateDietPlanInput,
  ExtendDietPlanInput,
} from "../schemas/common";

interface PlanMeal {
  id?: string;
  mealType?: string;
  recipeId?: string | null;
  recipeName?: string;
  localizedName?: string;
  servingMultiplier?: number;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  orderIndex?: number;
}

interface PlanDay {
  dayNumber?: number;
  dayOfWeek?: number;
  meals?: PlanMeal[];
}

interface DietPlan {
  id: string;
  name?: string;
  description?: string | null;
  durationDays?: number;
  dailyCalorieTarget?: number | null;
  dailyProteinTarget?: number | null;
  dailyCarbsTarget?: number | null;
  dailyFatTarget?: number | null;
  dietTemplate?: string | null;
  isActive?: boolean;
  startDate?: string | null;
  endDate?: string | null;
  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
  days?: PlanDay[];
}

function trimMeal(meal: PlanMeal): object {
  return {
    type: meal.mealType ?? null,
    recipe_id: meal.recipeId ?? null,
    name: meal.localizedName ?? meal.recipeName ?? null,
    servings: meal.servingMultiplier ?? 1,
    kcal: meal.calories ?? null,
    protein_g: meal.protein ?? null,
    carbs_g: meal.carbs ?? null,
    fat_g: meal.fat ?? null,
  };
}

function trimPlan(plan: DietPlan): object {
  return {
    id: plan.id,
    name: plan.name ?? null,
    template: plan.dietTemplate ?? null,
    active: plan.isActive ?? false,
    duration_days: plan.durationDays ?? null,
    start_date: plan.startDate ?? plan.plannedStartDate ?? null,
    end_date: plan.endDate ?? plan.plannedEndDate ?? null,
    daily_targets: {
      kcal: plan.dailyCalorieTarget ?? null,
      protein_g: plan.dailyProteinTarget ?? null,
      carbs_g: plan.dailyCarbsTarget ?? null,
      fat_g: plan.dailyFatTarget ?? null,
    },
  };
}

function expandPlan(plan: DietPlan, maxDays: number): object {
  const days = (plan.days ?? []).slice(0, maxDays);
  const daySummaries = days.map((day) => {
    const meals = day.meals ?? [];
    const total = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    for (const meal of meals) {
      total.kcal += meal.calories ?? 0;
      total.protein += meal.protein ?? 0;
      total.carbs += meal.carbs ?? 0;
      total.fat += meal.fat ?? 0;
    }
    return {
      day: day.dayNumber ?? null,
      weekday: day.dayOfWeek ?? null,
      totals: {
        kcal: Math.round(total.kcal),
        protein_g: Math.round(total.protein * 10) / 10,
        carbs_g: Math.round(total.carbs * 10) / 10,
        fat_g: Math.round(total.fat * 10) / 10,
      },
      meals: meals.map(trimMeal),
    };
  });

  return {
    ...trimPlan(plan),
    description: plan.description ?? null,
    days_shown: daySummaries.length,
    days_total: plan.days?.length ?? 0,
    days: daySummaries,
  };
}

/** Diet plans: list, inspect, generate, activate, extend. */
export function registerDietPlanTools(server: McpServer, auth: McpAuth, accessToken: string): void {
  server.registerTool(
    "get_diet_plans",
    {
      description:
        "The user's diet plans (or public templates with tab=discover). Returns headline targets only — call get_diet_plan for the day-by-day meals.",
      inputSchema: ListDietPlansInput,
      annotations: { readOnlyHint: true },
    },
    async (input) => {
      requireScope(auth, "nutrition:read");
      const res = await fitailyGet<any>(accessToken, "/diet-plans", {
        tab: input.tab ?? "mine",
        search: input.search,
      });
      const plans: DietPlan[] = res?.plans ?? res?.data ?? (Array.isArray(res) ? res : []);
      const filtered = input.activeOnly ? (plans as DietPlan[]).filter((p) => p.isActive) : (plans as DietPlan[]);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              tab: input.tab ?? "mine",
              count: filtered.length,
              plans: filtered.map(trimPlan),
            }),
          },
        ],
      };
    },
  );

  server.registerTool(
    "get_diet_plan",
    {
      description:
        "Full diet plan by id: day-by-day meals with per-meal and per-day macro totals. Use maxDays to keep long plans readable.",
      inputSchema: GetDietPlanInput,
      annotations: { readOnlyHint: true },
    },
    async (input) => {
      requireScope(auth, "nutrition:read");
      const res = await fitailyGet<any>(accessToken, `/diet-plans/${input.id}`);
      const plan: DietPlan | undefined = res?.plan ?? res?.data ?? res;
      if (!plan?.id) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: "Diet plan not found" }) }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(expandPlan(plan, input.maxDays ?? 7)) }],
      };
    },
  );

  server.registerTool(
    "generate_diet_plan",
    {
      description:
        "WRITE: generate a new diet plan and make it the active one (replaces the previous plan). Needs at least 3 recipes in the library or the public catalog — the catalog alone is enough. Templates: balanced, highprotein, lowcarb, keto, vegan, vegetarian. Confirm targets with the user first.",
      inputSchema: GenerateDietPlanInput,
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async (input) => {
      requireScope(auth, "nutrition:write");
      const res = await fitailySend<any>(accessToken, "POST", "/diet-plans/generate", {
        template: input.template ?? "balanced",
        calorieTarget: input.calorieTarget ?? 2000,
        proteinTarget: input.proteinTarget,
        carbsTarget: input.carbsTarget,
        fatTarget: input.fatTarget,
        durationDays: input.durationDays ?? 7,
        mealCount: input.mealCount ?? 4,
        tastePreference: input.tastePreference,
        cookingTimePreference: input.cookingTimePreference ?? "medium",
        breakfastPreference: input.breakfastPreference ?? "mixed",
        tags: input.tags ?? [],
        plannedStartDate: input.plannedStartDate,
        seed: input.seed ?? 1,
      });
      const plan: DietPlan | undefined = res?.full ?? res?.plan ?? res?.data ?? res;
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(plan?.id ? expandPlan(plan, 7) : { created: true }),
          },
        ],
      };
    },
  );

  server.registerTool(
    "activate_diet_plan",
    {
      description:
        "WRITE: make an existing diet plan the active one, optionally from a given start date. Confirm with the user first.",
      inputSchema: ActivateDietPlanInput,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async (input) => {
      requireScope(auth, "nutrition:write");
      const res = await fitailySend<any>(accessToken, "POST", `/diet-plans/${input.id}/activate`, {
        startDate: input.startDate,
      });
      const plan: DietPlan | undefined = res?.updated ?? res?.plan ?? res?.data ?? res;
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              activated: plan?.id ?? input.id,
              start_date: plan?.startDate ?? input.startDate ?? null,
            }),
          },
        ],
      };
    },
  );

  server.registerTool(
    "extend_diet_plan",
    {
      description:
        "WRITE: extend a diet plan by N more days (reuses the plan's template and targets). Confirm with the user first.",
      inputSchema: ExtendDietPlanInput,
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (input) => {
      requireScope(auth, "nutrition:write");
      const res = await fitailySend<any>(accessToken, "PATCH", `/diet-plans/${input.id}/extend`, {
        additionalDays: input.additionalDays,
      });
      const plan: DietPlan | undefined = res?.plan ?? res?.data ?? res;
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              id: plan?.id ?? input.id,
              duration_days: res?.durationDays ?? plan?.durationDays ?? null,
              days_total: plan?.days?.length ?? null,
            }),
          },
        ],
      };
    },
  );
}
