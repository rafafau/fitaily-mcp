import type { McpServer } from "@modelcontextprotocol/server";
import { randomUUID } from "crypto";
import { fitailyGet, fitailySend } from "../api/fitaily-client";
import type { McpAuth } from "../auth/verify";
import { requireScope } from "../auth/verify";
import { z } from "zod";
import {
  TodayNutritionInput,
  MealHistoryInput,
  AddMealInput,
  UpdateMealInput,
  DeleteMealInput,
  UpdateNutritionGoalsInput,
  SuggestMealInput,
} from "../schemas/common";

interface DaySummary {
  date: string;
  consumed?: { calories?: number; protein?: number; carbs?: number; fat?: number };
  goals?: { calories?: number; protein?: number; carbs?: number; fat?: number };
  remaining?: { calories?: number; protein?: number; carbs?: number; fat?: number };
  water?: { total?: number; goal?: number };
}

interface MealEntry {
  id: string;
  mealType: string;
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize?: string | null;
  date?: string;
}

/** yyyy-MM-dd plus N days (for half-open backend ranges). */
function addDays(day: string, n: number): string {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function trimMeal(m: MealEntry): object {  return {
    id: m.id,
    meal: m.mealType,
    food: m.foodName,
    kcal: m.calories,
    protein_g: m.protein,
    carbs_g: m.carbs,
    fat_g: m.fat,
    serving: m.servingSize ?? undefined,
  };
}

async function mealsForDay(accessToken: string, date?: string): Promise<MealEntry[]> {
  const day = date || new Date().toISOString().slice(0, 10);
  // Backend /nutrition uses a half-open range [gte, lt): a bare endDate is
  // midnight, so the same day would match nothing — bump it by one day.
  const res = await fitailyGet<any>(accessToken, "/nutrition", {
    startDate: day,
    endDate: addDays(day, 1),
    limit: 100,
  }).catch(() => ({ entries: [] }));
  const list = Array.isArray(res) ? res : res.entries || res.items || [];
  return (list as MealEntry[]).slice(0, 30);
}

/** GET /api/nutrition/day-summary + item list — answers "what did I eat". */
export function registerNutritionTools(server: McpServer, auth: McpAuth, accessToken: string): void {
  server.registerTool(
    "get_today_nutrition",
    {
      description:
        "Daily nutrition: consumed calories/macros, goals, remaining budget AND the itemized meal list. Defaults to today.",
      inputSchema: TodayNutritionInput,
      annotations: { readOnlyHint: true },
    },
    async (input) => {
      requireScope(auth, "nutrition:read");
      const [day, meals] = await Promise.all([
        fitailyGet<DaySummary>(accessToken, "/nutrition/day-summary", input.date ? { date: input.date } : {}),
        mealsForDay(accessToken, input.date),
      ]);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              date: day.date,
              calories: {
                consumed: day.consumed?.calories ?? 0,
                goal: day.goals?.calories ?? null,
                remaining: day.remaining?.calories ?? null,
              },
              macros: {
                protein_g: day.consumed?.protein ?? 0,
                carbs_g: day.consumed?.carbs ?? 0,
                fat_g: day.consumed?.fat ?? 0,
              },
              water_ml: day.water ? { consumed: day.water.total, goal: day.water.goal } : undefined,
              meals: meals.map(trimMeal),
            }),
          },
        ],
      };
    },
  );

  server.registerTool(
    "get_meal_history",
    {
      description: "Meal entries over a date range, optionally filtered by meal type.",
      inputSchema: MealHistoryInput,
      annotations: { readOnlyHint: true },
    },
    async (input) => {
      requireScope(auth, "nutrition:read");
      const params: Record<string, string | number | undefined> = {
        startDate: input.from,
        endDate: addDays(input.to, 1),
        limit: input.limit ?? 30,
      };
      if (input.mealType) params.mealType = input.mealType;
      const res = await fitailyGet<any>(accessToken, "/nutrition", params);
      const list = Array.isArray(res) ? res : res.entries || res.items || [];
      return {
        content: [{ type: "text", text: JSON.stringify({ meals: (list as MealEntry[]).slice(0, input.limit ?? 30).map(trimMeal) }) }],
      };
    },
  );

  server.registerTool(
    "get_nutrition_goals",
    {
      description: "Current daily calorie and macro goals.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    async () => {
      requireScope(auth, "nutrition:read");
      const goals = await fitailyGet<any>(accessToken, "/nutrition-goals", {});
      return { content: [{ type: "text", text: JSON.stringify(goals) }] };
    },
  );

  server.registerTool(
    "suggest_meal",
    {
      description:
        "What to eat next for a given meal type: the backend splits the remaining daily budget across meals and ranks candidates from the user's history, recipes and products. Returns projected macros and a match score; falls back to recipes when nothing fits.",
      inputSchema: SuggestMealInput,
      annotations: { readOnlyHint: true },
    },
    async (input) => {
      requireScope(auth, "nutrition:read");
      const date = input.date ?? new Date().toISOString().slice(0, 10);
      const res = await fitailyGet<any>(accessToken, "/meals/meal-suggestion/suggestions", {
        mealType: input.mealType,
        date,
      });
      const suggestions: any[] = res?.suggestions ?? [];
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              date,
              meal_type: input.mealType,
              meal_target: res?.mealTarget ?? null,
              daily_remaining: res?.dailyRemaining ?? null,
              suggestions: suggestions.slice(0, input.limit ?? 5).map((s) => ({
                source: s.source ?? null,
                recipe_id: s.recipeId ?? null,
                recipe: s.recipeName ?? null,
                product_id: s.productId ?? null,
                product: s.productName ?? null,
                grams: s.gramsToUse ?? null,
                servings: s.servingMultiplier ?? null,
                combo: s.comboItems ?? null,
                projected: s.projected ?? null,
                match_score: s.matchScore ?? null,
              })),
              offer_ai_fallback: res?.offerAiFallback ?? false,
            }),
          },
        ],
      };
    },
  );

  server.registerTool(
    "update_nutrition_goals",
    {
      description:
        "WRITE: change daily calorie/macro goals. Confirm the new numbers with the user first.",
      inputSchema: UpdateNutritionGoalsInput,
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (input) => {
      requireScope(auth, "nutrition:write");
      const goals = await fitailySend<any>(accessToken, "PATCH", "/nutrition-goals", input);
      return { content: [{ type: "text", text: JSON.stringify(goals) }] };
    },
  );

  server.registerTool(
    "add_meal",
    {
      description:
        "WRITE: log a meal. Ask the user to confirm first (dish, meal type, macros). Macros are required — look them up with search_foods, never invent them. clientRequestId: generate once per user request (uuid) and reuse it if you retry, so a retry never duplicates the meal.",
      inputSchema: AddMealInput,
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (input) => {
      requireScope(auth, "nutrition:write");
      const created = await fitailySend<any>(accessToken, "POST", "/nutrition", {
        mealType: input.mealType,
        foodName: input.foodName,
        calories: input.calories,
        protein: input.protein,
        carbs: input.carbs,
        fat: input.fat,
        servingSize: input.servingSize,
        date: input.date,
        clientRequestId: input.clientRequestId || randomUUID(),
      });
      const entry = (created as any).id ? created : created;
      return { content: [{ type: "text", text: JSON.stringify({ meal: trimMeal(entry as MealEntry) }) }] };
    },
  );

  server.registerTool(
    "update_meal",
    {
      description: "WRITE: edit a logged meal by id (from get_today_nutrition/get_meal_history). Confirm with the user first.",
      inputSchema: UpdateMealInput,
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (input) => {
      requireScope(auth, "nutrition:write");
      const { id, ...patch } = input;
      const updated = await fitailySend<any>(accessToken, "PUT", `/nutrition/${id}`, patch);
      return { content: [{ type: "text", text: JSON.stringify({ meal: trimMeal(updated as MealEntry) }) }] };
    },
  );

  server.registerTool(
    "delete_meal",
    {
      description: "WRITE: delete a logged meal by id. Confirm with the user first.",
      inputSchema: DeleteMealInput,
      annotations: { destructiveHint: true },
    },
    async (input) => {
      requireScope(auth, "nutrition:write");
      await fitailySend(accessToken, "DELETE", `/nutrition/${input.id}`);
      return { content: [{ type: "text", text: JSON.stringify({ deleted: input.id }) }] };
    },
  );
}
