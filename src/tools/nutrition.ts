import type { McpServer } from "@modelcontextprotocol/server";
import { randomUUID } from "crypto";
import { fitailyGet, fitailySend } from "../api/fitaily-client.js";
import { listOf, type MealSuggestion, type MealSuggestions, type NutritionGoals } from "../api/types.js";
import type { CreatedEntity } from "../api/types.js";
import type { McpAuth } from "../auth/verify.js";
import { requireScope } from "../auth/verify.js";
import { z } from "zod";
import {
  TodayNutritionInput,
  MealHistoryInput,
  AddMealInput,
  UpdateMealInput,
  DeleteMealInput,
  UpdateNutritionGoalsInput,
  SuggestMealInput,
} from "../schemas/common.js";
import { JsonObjectOutput, jsonResult } from "../utils/result.js";

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

function trimMeal(m: MealEntry): object {
  return {
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
  const res = await fitailyGet<unknown>(accessToken, "/nutrition", {
    startDate: day,
    endDate: addDays(day, 1),
    limit: 100,
  }).catch(() => ({ entries: [] }));
  return listOf<MealEntry>(res, "entries", "items").slice(0, 30);
}

/** GET /api/nutrition/day-summary + item list — answers "what did I eat". */
export function registerNutritionTools(server: McpServer, auth: McpAuth, accessToken: string): void {
  server.registerTool(
    "get_today_nutrition",
    {
      description:
        "Daily nutrition: consumed calories/macros, goals, remaining budget AND the itemized meal list. Defaults to today.",
      inputSchema: TodayNutritionInput,
      outputSchema: JsonObjectOutput,
      annotations: { readOnlyHint: true },
    },
    async (input: z.infer<typeof TodayNutritionInput>) => {
      requireScope(auth, "nutrition:read");
      const [day, meals] = await Promise.all([
        fitailyGet<DaySummary>(accessToken, "/nutrition/day-summary", input.date ? { date: input.date } : {}),
        mealsForDay(accessToken, input.date),
      ]);
      return jsonResult({
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
      });
    },
  );

  server.registerTool(
    "get_meal_history",
    {
      description: "Meal entries over a date range, optionally filtered by meal type.",
      inputSchema: MealHistoryInput,
      outputSchema: JsonObjectOutput,
      annotations: { readOnlyHint: true },
    },
    async (input: z.infer<typeof MealHistoryInput>) => {
      requireScope(auth, "nutrition:read");
      const params: Record<string, string | number | undefined> = {
        startDate: input.from,
        endDate: addDays(input.to, 1),
        limit: input.limit ?? 30,
      };
      if (input.mealType) params.mealType = input.mealType;
      const res = await fitailyGet<unknown>(accessToken, "/nutrition", params);
      const list = listOf<MealEntry>(res, "entries", "items");
      return jsonResult({ meals: list.slice(0, input.limit ?? 30).map(trimMeal) });
    },
  );

  server.registerTool(
    "get_nutrition_goals",
    {
      description: "Current daily calorie and macro goals.",
      inputSchema: z.object({}),
      outputSchema: JsonObjectOutput,
      annotations: { readOnlyHint: true },
    },
    async () => {
      requireScope(auth, "nutrition:read");
      const goals = await fitailyGet<NutritionGoals>(accessToken, "/nutrition-goals", {});
      return jsonResult(goals);
    },
  );

  server.registerTool(
    "suggest_meal",
    {
      description:
        "What to eat next for a given meal type: the backend splits the remaining daily budget across meals and ranks candidates from the user's history, recipes and products. Returns projected macros and a match score; falls back to recipes when nothing fits.",
      inputSchema: SuggestMealInput,
      outputSchema: JsonObjectOutput,
      annotations: { readOnlyHint: true },
    },
    async (input: z.infer<typeof SuggestMealInput>) => {
      requireScope(auth, "nutrition:read");
      const date = input.date ?? new Date().toISOString().slice(0, 10);
      const res = await fitailyGet<MealSuggestions>(accessToken, "/meals/meal-suggestion/suggestions", {
        mealType: input.mealType,
        date,
      });
      const suggestions: MealSuggestion[] = Array.isArray(res?.suggestions) ? res.suggestions : [];
      return jsonResult({
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
      });
    },
  );

  server.registerTool(
    "update_nutrition_goals",
    {
      description: "WRITE: change daily calorie/macro goals. Confirm the new numbers with the user first.",
      inputSchema: UpdateNutritionGoalsInput,
      outputSchema: JsonObjectOutput,
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (input: z.infer<typeof UpdateNutritionGoalsInput>) => {
      requireScope(auth, "nutrition:write");
      const goals = await fitailySend<NutritionGoals>(accessToken, "PATCH", "/nutrition-goals", input);
      return jsonResult(goals);
    },
  );

  server.registerTool(
    "add_meal",
    {
      description:
        "WRITE: log a meal. Ask the user to confirm first (dish, meal type, macros). Macros are required — look them up with search_foods, never invent them. clientRequestId: generate once per user request (uuid) and reuse it if you retry, so a retry never duplicates the meal.",
      inputSchema: AddMealInput,
      outputSchema: JsonObjectOutput,
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (input: z.infer<typeof AddMealInput>) => {
      requireScope(auth, "nutrition:write");
      const created = await fitailySend<CreatedEntity>(accessToken, "POST", "/nutrition", {
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
      return jsonResult({ meal: trimMeal(created as MealEntry) });
    },
  );

  server.registerTool(
    "update_meal",
    {
      description:
        "WRITE: edit a logged meal by id (from get_today_nutrition/get_meal_history). Confirm with the user first.",
      inputSchema: UpdateMealInput,
      outputSchema: JsonObjectOutput,
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (input: z.infer<typeof UpdateMealInput>) => {
      requireScope(auth, "nutrition:write");
      const { id, ...patch } = input;
      const updated = await fitailySend<MealEntry>(accessToken, "PUT", `/nutrition/${id}`, patch);
      return jsonResult({ meal: trimMeal(updated) });
    },
  );

  server.registerTool(
    "delete_meal",
    {
      description: "WRITE: delete a logged meal by id. Confirm with the user first.",
      inputSchema: DeleteMealInput,
      outputSchema: JsonObjectOutput,
      annotations: { destructiveHint: true },
    },
    async (input) => {
      requireScope(auth, "nutrition:write");
      await fitailySend(accessToken, "DELETE", `/nutrition/${input.id}`);
      return jsonResult({ deleted: input.id });
    },
  );
}
