import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { sign } from "jsonwebtoken";
import { McpServer } from "@modelcontextprotocol/server";
import { verifyMcpToken } from "../src/auth/verify";
import { registerNutritionTools } from "../src/tools/nutrition";
import { registerFoodTools } from "../src/tools/foods";
import { registerWaterTools } from "../src/tools/water";
import { registerTrainingTools } from "../src/tools/training";
import { registerProgressTools } from "../src/tools/progress";
import { registerRecipeTools } from "../src/tools/recipes";
import { registerDietPlanTools } from "../src/tools/dietPlans";
import { registerProfileTools } from "../src/tools/profile";
import { registerStatsTools } from "../src/tools/stats";
import { registerStrengthStatsTools } from "../src/tools/strengthStats";
import { registerPantryTools } from "../src/tools/pantry";
import { registerExerciseTools } from "../src/tools/exercises";

const SECRET = "test-secret";
const RESOURCE = "https://mcp.fitaily.com/mcp";

function authHeader(scopes: string): string {
  const t = sign({ userId: "u1", scope: scopes, aud: RESOURCE }, SECRET, {
    expiresIn: "15m",
    algorithm: "HS256",
  } as any);
  return `Bearer ${t}`;
}

type Handler = (input: any) => Promise<any>;
const handlers = new Map<string, Handler>();

class FakeServer {
  registerTool(name: string, _def: unknown, handler: Handler): void {
    handlers.set(name, handler);
  }
}

function wire(scopes = "nutrition:read nutrition:write training:read training:write progress:read progress:write"): void {
  handlers.clear();
  const auth = verifyMcpToken(authHeader(scopes));
  const srv = new FakeServer() as unknown as McpServer;
  registerNutritionTools(srv, auth, "tok");
  registerFoodTools(srv, auth, "tok");
  registerWaterTools(srv, auth, "tok");
  registerTrainingTools(srv, auth, "tok");
  registerProgressTools(srv, auth, "tok");
  registerRecipeTools(srv, auth, "tok");
  registerDietPlanTools(srv, auth, "tok");
  registerProfileTools(srv, auth, "tok");
  registerStatsTools(srv, auth, "tok");
  registerStrengthStatsTools(srv, auth, "tok");
  registerPantryTools(srv, auth, "tok");
  registerExerciseTools(srv, auth, "tok");
}

const calls: Array<{ url: string; method: string; body?: any }> = [];

function stubFetch(routes: Record<string, any>): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(async (url: URL, init?: any) => {
      const u = String(url);
      calls.push({ url: u, method: init?.method || "GET", body: init?.body ? JSON.parse(init.body) : undefined });
      for (const [key, val] of Object.entries(routes)) {
        if (u.includes(key)) {
          const status = (val as any).__status || 200;
          return { ok: status < 300, status, json: async () => val };
        }
      }
      return { ok: false, status: 404, json: async () => ({}) };
    }),
  );
}

beforeEach(() => {
  process.env.JWT_SECRET = SECRET;
  process.env.MCP_RESOURCE_URL = RESOURCE;
  process.env.FITAILY_API_URL = "http://api.test/api";
  calls.length = 0;
});
afterEach(() => vi.unstubAllGlobals());

describe("get_today_nutrition with meals", () => {
  it("merges day-summary with the item list", async () => {
    wire();
    stubFetch({
      "/nutrition/day-summary": { date: "2026-10-16", consumed: { calories: 283 }, goals: { calories: 1751 }, remaining: { calories: 1468 } },
      "/nutrition?": { entries: [{ id: "m1", mealType: "breakfast", foodName: "Jajka", calories: 283, protein: 21.8, carbs: 1, fat: 21.5 }] },
    });
    const out = await handlers.get("get_today_nutrition")!({});
    const text = out.content[0].text;
    expect(text).toContain("Jajka");
    expect(text).toContain("1468");
  });
});

describe("get_meal_history", () => {
  it("bumps endDate by one day (backend range is half-open)", async () => {
    wire();
    stubFetch({ "/nutrition?": { entries: [] } });
    await handlers.get("get_meal_history")!({ from: "2026-10-16", to: "2026-10-16" });
    expect(calls[0].url).toContain("startDate=2026-10-16");
    expect(calls[0].url).toContain("endDate=2026-10-17");
  });
});

describe("meal writes", () => {  it("add_meal POSTs with clientRequestId", async () => {
    wire();
    stubFetch({ "/nutrition": { id: "n1", mealType: "snack", foodName: "Skyr", calories: 100, protein: 15, carbs: 5, fat: 1 } });
    const out = await handlers.get("add_meal")!({
      mealType: "snack", foodName: "Skyr", calories: 100, protein: 15, carbs: 5, fat: 1, clientRequestId: "req-1",
    });
    expect(calls[0].method).toBe("POST");
    expect(calls[0].body.clientRequestId).toBe("req-1");
    expect(out.content[0].text).toContain("Skyr");
  });

  it("update/delete hit the entry URL", async () => {
    wire();
    stubFetch({ "/n9": { id: "n9", mealType: "dinner", foodName: "X", calories: 1, protein: 1, carbs: 1, fat: 1 } });
    await handlers.get("update_meal")!({ id: "n9", calories: 500 });
    await handlers.get("delete_meal")!({ id: "n9" });
    expect(calls[0].method).toBe("PUT");
    expect(calls[0].url).toContain("/nutrition/n9");
    expect(calls[1].method).toBe("DELETE");
  });

  it("write without scope throws 403", async () => {
    wire("nutrition:read");
    stubFetch({});
    await expect(
      handlers.get("add_meal")!({ mealType: "snack", foodName: "X", calories: 1, protein: 1, carbs: 1, fat: 1 }),
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe("foods", () => {
  it("search_foods trims to per-100g macros", async () => {
    wire();
    stubFetch({ "/products": { products: [{ id: "p1", name: "Twaróg", brand: "B", caloriesPer100: 120, proteinPer100: 18, carbsPer100: 4, fatPer100: 2 }] } });
    const out = await handlers.get("search_foods")!({ query: "twaróg" });
    expect(out.content[0].text).toContain("Twaróg");
    expect(out.content[0].text).toContain("per_100g");
  });
});

describe("water", () => {
  it("log_water sends amount in ml", async () => {
    wire();
    stubFetch({ "/water/log": { id: "w1" } });
    await handlers.get("log_water")!({ amountMl: 250 });
    expect(calls[0].body.amount).toBe(250);
  });
});

describe("training", () => {
  it("log_activity converts minutes to seconds", async () => {
    wire();
    stubFetch({ "/activity": { id: "a1" } });
    await handlers.get("log_activity")!({ type: "running", name: "Poranny bieg", durationMin: 30, distanceKm: 5 });
    expect(calls[0].body.duration).toBe(1800);
    expect(calls[0].body.distance).toBe(5);
  });

  it("get_training_plan lists both plan types", async () => {
    wire();
    stubFetch({ "/training-plans": [{ id: "t1", name: "Maraton" }], "/workout-plans": [{ id: "w1", name: "Push" }] });
    const out = await handlers.get("get_training_plan")!({});
    expect(out.content[0].text).toContain("Maraton");
    expect(out.content[0].text).toContain("Push");
  });
});

describe("progress", () => {
  it("add_measurement POSTs weight", async () => {
    wire();
    stubFetch({ "/measurements": { id: "m1" } });
    await handlers.get("add_measurement")!({ weight: 82.5 });
    expect(calls[0].method).toBe("POST");
    expect(calls[0].body.weight).toBe(82.5);
  });

  it("get_goals trims to id/type/values", async () => {
    wire();
    stubFetch({ "/goals": { goals: [{ id: "g1", type: "weight", name: "Waga", currentValue: 82, targetValue: 78, unit: "kg", isActive: true, isCompleted: false }] } });
    const out = await handlers.get("get_goals")!({});
    expect(out.content[0].text).toContain("Waga");
  });
});

describe("recipes", () => {
  it("filters by maxTimeMin and caps the list", async () => {
    wire();
    stubFetch({
      "/recipes/discovery": {
        sections: [{
          key: "fit", items: [
            { id: "r1", title: "Szybka", calories: 400, proteinGrams: 30, carbsGrams: 20, fatGrams: 10, durationMinutes: 15, servings: 2 },
            { id: "r2", title: "Wolna", calories: 400, proteinGrams: 30, carbsGrams: 20, fatGrams: 10, durationMinutes: 120, servings: 2 },
          ],
        }],
      },
    });
    const out = await handlers.get("get_recipe_suggestions")!({ maxTimeMin: 30, limit: 5 });
    expect(out.content[0].text).toContain("Szybka");
    expect(out.content[0].text).not.toContain("Wolna");
  });
});

describe("recipes CRUD", () => {
  it("create_recipe POSTs ingredients and steps", async () => {
    wire();
    stubFetch({ "/recipes": { id: "r1", name: "Kopytka", servings: 4, prepTimeMinutes: 20, cookTimeMinutes: 15 } });
    const out = await handlers.get("create_recipe")!({
      name: "Kopytka",
      prepTimeMinutes: 20,
      cookTimeMinutes: 15,
      servings: 4,
      ingredients: [{ productName: "Ziemniaki", amount: 500, unit: "g" }],
      steps: [{ instruction: "Ugotuj ziemniaki" }],
    });
    expect(calls[0].method).toBe("POST");
    expect(calls[0].body.ingredients[0].productName).toBe("Ziemniaki");
    expect(out.content[0].text).toContain("Kopytka");
  });

  it("get_recipe returns numbered steps and ingredients", async () => {
    wire();
    stubFetch({ "/recipes/r1": { id: "r1", name: "X", ingredients: [{ productName: "Mąka", amount: 200, unit: "g" }], steps: [{ instruction: "Wymieszaj" }] } });
    const out = await handlers.get("get_recipe")!({ id: "r1" });
    expect(out.content[0].text).toContain("Mąka");
    expect(out.content[0].text).toContain("\"step\":1");
  });

  it("delete_recipe hits the id URL", async () => {
    wire();
    stubFetch({ "/recipes/r9": {} });
    await handlers.get("delete_recipe")!({ id: "r9" });
    expect(calls[0].method).toBe("DELETE");
    expect(calls[0].url).toContain("/recipes/r9");
  });
});

describe("exercise catalog", () => {
  it("search_exercises trims to id/name/muscle", async () => {
    wire();
    stubFetch({ "/exercises/global": { exercises: [{ id: "e1", name: "Bench Press", category: "CHEST", muscleGroup: "Pectoralis", equipment: "Barbell" }] } });
    const out = await handlers.get("search_exercises")!({ search: "bench" });
    expect(out.content[0].text).toContain("Bench Press");
    expect(out.content[0].text).toContain("Pectoralis");
  });
});

describe("workout plans", () => {
  it("create_workout_plan assigns orderIndex from position", async () => {
    wire();
    stubFetch({ "/workout-plans": { id: "p1", name: "Push", exercises: [{ exerciseId: "e1", sets: 4, reps: "8-12" }] } });
    const out = await handlers.get("create_workout_plan")!({
      name: "Push",
      exercises: [{ exerciseId: "e1", sets: 4, reps: "8-12" }, { exerciseId: "e2", sets: 3 }],
    });
    expect(calls[0].method).toBe("POST");
    expect(calls[0].body.exercises[0].orderIndex).toBe(0);
    expect(calls[0].body.exercises[1].orderIndex).toBe(1);
    expect(out.content[0].text).toContain("Push");
  });

  it("update_workout_plan replaces the exercise list only when sent", async () => {
    wire();
    stubFetch({ "/workout-plans/p1": { id: "p1", name: "Push B", exercises: [] } });
    await handlers.get("update_workout_plan")!({ id: "p1", name: "Push B" });
    expect(calls[0].method).toBe("PUT");
    expect(calls[0].body.exercises).toBeUndefined();
  });

  it("get_workout_plans lists templates", async () => {
    wire();
    stubFetch({ "/workout-plans": [{ id: "p1", name: "Push", exercises: [{ exerciseId: "e1", sets: 3, exercise: { name: "Bench" } }] }] });
    const out = await handlers.get("get_workout_plans")!({});
    expect(out.content[0].text).toContain("Bench");
  });
});

describe("recipe catalog", () => {
  it("passes nutrition filters and keeps pagination metadata", async () => {
    wire();
    stubFetch({
      "/recipes/public": {
        data: [
          {
            id: "r1",
            name: "Kurczak", slug: "kurczak", servings: 2, totalTimeMinutes: 25,
            nutrition: { caloriesPerServing: 380, proteinPerServing: 42, carbsPerServing: 12, fatPerServing: 14 },
            rating: { average: 4.5, count: 2 }, tags: [{ slug: "high-protein", label: "High protein" }],
          },
        ],
        pagination: { page: 2, limit: 10, total: 23, totalPages: 3, hasNext: true, hasPrev: true },
      },
    });
    const out = await handlers.get("search_public_recipes")!({
      search: "kurczak", minProtein: 30, maxCalories: 500, sort: "protein_desc", page: 2, limit: 10,
    });
    const text = out.content[0].text;
    expect(text).toContain("high-protein");
    expect(text).toContain('"total":23');
    expect(calls[0].url).toContain("minProtein=30");
    expect(calls[0].url).toContain("maxCalories=500");
    expect(calls[0].url).toContain("sort=protein_desc");
    expect(calls[0].url).toContain("page=2");
  });

  it("get_recipe_tags lists slugs with counts", async () => {
    wire();
    stubFetch({ "/recipes/tags": { data: [{ slug: "vegan", label: "Vegan", count: 6 }] } });
    const out = await handlers.get("get_recipe_tags")!({});
    expect(out.content[0].text).toContain("vegan");
    expect(out.content[0].text).toContain("6");
  });

  it("get_public_recipe fetches by slug", async () => {
    wire();
    stubFetch({
      "/recipes/public/kurczak": {
        id: "r1", name: "Kurczak", slug: "kurczak", servings: 2,
        nutrition: { caloriesPerServing: 380, proteinPerServing: 42 },
        ingredients: [{ productName: "Pierś", amount: 400, unit: "g" }],
        steps: [{ instruction: "Upiecz" }],
      },
    });
    const out = await handlers.get("get_public_recipe")!({ slug: "kurczak" });
    expect(out.content[0].text).toContain("Pierś");
    expect(out.content[0].text).toContain("kcal_per_serving");
  });

  it("favorite_recipe toggles POST/DELETE", async () => {
    wire();
    stubFetch({ "/recipes/r1/favorite": {} });
    await handlers.get("favorite_recipe")!({ recipeId: "r1", favorite: true });
    await handlers.get("favorite_recipe")!({ recipeId: "r1", favorite: false });
    expect(calls[0].method).toBe("POST");
    expect(calls[1].method).toBe("DELETE");
  });

  it("rate_recipe posts the star value", async () => {
    wire();
    stubFetch({ "/recipes/r1/rate": { rating: 4 } });
    const out = await handlers.get("rate_recipe")!({ recipeId: "r1", rating: 4 });
    expect(calls[0].body.rating).toBe(4);
    expect(out.content[0].text).toContain('"rating":4');
  });

  it("find_recipes_for_remaining_macros uses the day budget", async () => {
    wire();
    stubFetch({
      "/nutrition/day-summary": {
        date: "2026-10-19",
        remaining: { calories: 800, protein: 60, carbs: 80, fat: 20 },
      },
      "/recipes/public": {
        data: [
          { id: "r1", name: "Omlet", nutrition: { caloriesPerServing: 300, proteinPerServing: 25, carbsPerServing: 5, fatPerServing: 20 } },
          { id: "r2", name: "Tort", nutrition: { caloriesPerServing: 900, proteinPerServing: 10, carbsPerServing: 100, fatPerServing: 40 } },
        ],
      },
    });
    const out = await handlers.get("find_recipes_for_remaining_macros")!({ date: "2026-10-19", mealType: "lunch" });
    const text = out.content[0].text;
    expect(text).toContain("Omlet");
    expect(text).not.toContain("Tort");
    expect(text).toContain('"remaining_calories":800');
  });
});

describe("meal suggestions", () => {
  it("suggest_meal returns the budget and ranked picks", async () => {
    wire();
    stubFetch({
      "/meals/meal-suggestion/suggestions": {
        data: {
          mealTarget: { calories: 500, protein: 40, carbs: 50, fat: 15 },
          dailyRemaining: { calories: 1200, protein: 90, carbs: 120, fat: 40 },
          suggestions: [{ source: "recipe", recipeId: "r1", recipeName: "Kurczak", projected: { calories: 480 }, matchScore: 88 }],
          offerAiFallback: false,
        },
      },
    });
    const out = await handlers.get("suggest_meal")!({ mealType: "dinner", date: "2026-10-19" });
    expect(out.content[0].text).toContain("Kurczak");
    expect(calls[0].url).toContain("mealType=dinner");
  });
});

describe("diet plans", () => {
  it("get_diet_plans trims to headline targets", async () => {
    wire();
    stubFetch({
      "/diet-plans": {
        plans: [{
          id: "p1", name: "Balanced 7d", durationDays: 7, dietTemplate: "balanced", isActive: true,
          dailyCalorieTarget: 2000, dailyProteinTarget: 150, days: [{ dayNumber: 1, meals: [] }],
        }],
      },
    });
    const out = await handlers.get("get_diet_plans")!({});
    expect(out.content[0].text).toContain("Balanced 7d");
    expect(out.content[0].text).toContain("daily_targets");
  });

  it("get_diet_plan expands meals and sums day macros", async () => {
    wire();
    stubFetch({
      "/diet-plans/p1": {
        plan: {
          id: "p1", name: "Plan", durationDays: 1,
          days: [{ dayNumber: 1, dayOfWeek: 1, meals: [{ mealType: "lunch", recipeName: "Kurczak", calories: 500, protein: 40, carbs: 30, fat: 20 }] }],
        },
      },
    });
    const out = await handlers.get("get_diet_plan")!({ id: "p1" });
    expect(out.content[0].text).toContain("Kurczak");
    expect(out.content[0].text).toContain('"protein_g":40');
  });

  it("generate_diet_plan posts targets and returns the plan", async () => {
    wire();
    stubFetch({ "/diet-plans/generate": { full: { id: "p2", name: "High protein", days: [] } } });
    const out = await handlers.get("generate_diet_plan")!({
      template: "highprotein", calorieTarget: 2200, durationDays: 7, plannedStartDate: "2026-10-20",
    });
    expect(calls[0].method).toBe("POST");
    expect(calls[0].body.template).toBe("highprotein");
    expect(calls[0].body.calorieTarget).toBe(2200);
    expect(out.content[0].text).toContain("High protein");
  });

  it("activate/extend hit their endpoints", async () => {
    wire();
    stubFetch({ "/diet-plans/p1/activate": { updated: { id: "p1", startDate: "2026-10-20" } }, "/diet-plans/p1/extend": { durationDays: 14 } });
    await handlers.get("activate_diet_plan")!({ id: "p1", startDate: "2026-10-20" });
    await handlers.get("extend_diet_plan")!({ id: "p1", additionalDays: 7 });
    expect(calls[0].url).toContain("/diet-plans/p1/activate");
    expect(calls[1].method).toBe("PATCH");
    expect(calls[1].body.additionalDays).toBe(7);
  });
});

describe("profile, coach and dashboard", () => {
  it("get_profile maps body data", async () => {
    wire();
    stubFetch({
      "/auth/me": { id: "u1", displayName: "Rafał", height: 180, language: "pl", targetWeight: 78, dailyCaloriesGoal: 2200 },
      "/measurements/latest": { weight: 82, date: "2026-10-18" },
    });
    const out = await handlers.get("get_profile")!({});
    expect(out.content[0].text).toContain("Rafał");
    expect(out.content[0].text).toContain('"weight_kg":82');
    expect(out.content[0].text).toContain('"target_weight_kg":78');
  });

  it("get_coach_plan returns active=false when missing", async () => {
    wire();
    stubFetch({ "/coach/profile": { __status: 404 } });
    const out = await handlers.get("get_coach_plan")!({});
    expect(out.content[0].text).toContain('"active":false');
  });

  it("get_dashboard_summary maps headline stats", async () => {
    wire();
    stubFetch({ "/dashboard/stats": { calories: 1400, workouts: 3, weight: 81.5, records: 2 } });
    const out = await handlers.get("get_dashboard_summary")!({});
    expect(out.content[0].text).toContain('"workouts_this_week":3');
  });
});

describe("period stats", () => {
  it("get_nutrition_stats passes the resolved range", async () => {
    wire();
    stubFetch({ "/nutrition/stats": { totals: { calories: 14000 }, averagePerDay: { calories: 2000 }, entryCount: 42 } });
    const out = await handlers.get("get_nutrition_stats")!({ from: "2026-10-01", to: "2026-10-10" });
    expect(calls[0].url).toContain("startDate=2026-10-01");
    expect(calls[0].url).toContain("endDate=2026-10-10");
    expect(out.content[0].text).toContain("2000");
  });

  it("get_activity_stats trims by type", async () => {
    wire();
    stubFetch({ "/activity/stats": { totals: { duration: 3600, caloriesBurned: 500, distance: 10 }, byType: { running: { count: 2 } } } });
    const out = await handlers.get("get_activity_stats")!({});
    expect(out.content[0].text).toContain("by_type");
  });

  it("get_measurement_stats maps body metrics", async () => {
    wire();
    stubFetch({ "/measurements/stats": { count: 5, weight: { min: 80, max: 83, avg: 81.4, latest: 81, first: 83 } } });
    const out = await handlers.get("get_measurement_stats")!({});
    expect(out.content[0].text).toContain('"count":5');
  });

  it("get_goal_progress joins goals with their progress", async () => {
    wire();
    stubFetch({
      "/goals/progress": { data: [{ goalId: "g1", remaining: 3, percentComplete: 62.5, isOnTrack: true }] },
      "/goals?": { data: [{ id: "g1", type: "weight", name: "Waga", currentValue: 82, targetValue: 79, unit: "kg" }] },
      "/goals": { data: [{ id: "g1", type: "weight", name: "Waga", currentValue: 82, targetValue: 79, unit: "kg" }] },
    });
    const out = await handlers.get("get_goal_progress")!({});
    expect(out.content[0].text).toContain("Waga");
    expect(out.content[0].text).toContain('"percent":62.5');
  });

  it("get_forecast posts the metric and maps confidence bands", async () => {
    wire();
    stubFetch({
      "/predictions/forecast": {
        success: true,
        metric: "weight",
        unit: "kg",
        engineType: "timesfm",
        forecast: [{ date: "2026-10-20T00:00:00.000Z", value: 81.9, confidenceLower: 81.2, confidenceUpper: 82.6 }],
      },
    });
    const out = await handlers.get("get_forecast")!({ metric: "weight", predictionDays: 7 });
    expect(calls[0].method).toBe("POST");
    expect(calls[0].body.metric).toBe("weight");
    expect(calls[0].body.predictionDays).toBe(7);
    expect(out.content[0].text).toContain('"lower":81.2');
  });

  it("query_nutrition_history aggregates by product", async () => {
    wire();
    stubFetch({
      "/stats/nutrition-history": {
        data: [
          { foodName: "Skyr", productBarcode: null, occurrences: 4, avgCalories: 120, avgProtein: 18, avgCarbs: 6, avgFat: 1 },
          { foodName: "Jajka", productBarcode: null, occurrences: 2, avgCalories: 140, avgProtein: 12, avgCarbs: 1, avgFat: 10 },
        ],
      },
    });
    const out = await handlers.get("query_nutrition_history")!({ from: "2026-10-01", to: "2026-10-19" });
    const text = out.content[0].text;
    expect(text).toContain("Skyr");
    expect(text).toContain('"times":4');
    expect(calls[0].url).toContain("startDate=2026-10-01");
    expect(calls[0].url).toContain("endDate=2026-10-19");
  });

  it("get_metric_trend returns the chart-friendly series", async () => {
    wire();
    stubFetch({
      "/stats/metric-trend": {
        data: {
          category: "measurement",
          metric: "weight",
          unit: "kg",
          points: [{ date: "2026-10-18", value: 75.2 }, { date: "2026-10-19", value: 74.8 }],
          delta: -0.4,
          startValue: 75.2,
          endValue: 74.8,
        },
      },
    });
    const out = await handlers.get("get_metric_trend")!({ category: "measurement", metric: "weight", from: "2026-10-01", to: "2026-10-19" });
    const text = out.content[0].text;
    expect(text).toContain('"category":"measurement"');
    expect(text).toContain('"delta":-0.4');
    expect(text).toContain('"endValue":74.8');
    expect(calls[0].url).toContain("category=measurement");
  });
});

describe("strength stats", () => {
  it("get_personal_records lists current records with deltas", async () => {
    wire();
    stubFetch({
      "/exercises/records/all": { data: [{ exerciseId: "e1", exerciseName: "Bench Press", recordType: "ONE_RM", value: 100, unit: "kg", previousValue: 95, achievedAt: "2026-10-10T10:00:00Z" }] },
    });
    const out = await handlers.get("get_personal_records")!({});
    expect(out.content[0].text).toContain("Bench Press");
    expect(out.content[0].text).toContain('"previous_value":95');
  });

  it("get_exercise_history passes months", async () => {
    wire();
    stubFetch({ "/workouts/exercise-history/e1": { data: [{ date: "2026-10-10", sets: [{ reps: 8, weight: 80, isCompleted: true }] }] } });
    await handlers.get("get_exercise_history")!({ exerciseId: "e1", months: 6 });
    expect(calls[0].url).toContain("months=6");
  });

  it("get_muscle_activation defaults since to 30 days ago", async () => {
    wire();
    stubFetch({ "/workouts/muscle-activation": { exercises: [{ exerciseId: "e1", name: "Squat", completedSets: 12 }] } });
    const out = await handlers.get("get_muscle_activation")!({});
    expect(calls[0].url).toContain("since=");
    expect(out.content[0].text).toContain("Squat");
  });
});

describe("fridge and shopping list", () => {
  it("get_fridge trims the inventory", async () => {
    wire();
    stubFetch({ "/fridge": { data: [{ id: "f1", name: "Jajka", quantity: "10", category: "dairy", expiryDate: "2026-10-25" }] } });
    const out = await handlers.get("get_fridge")!({});
    expect(out.content[0].text).toContain("Jajka");
  });

  it("add_fridge_item posts the item", async () => {
    wire();
    stubFetch({ "/fridge": { id: "f2" } });
    await handlers.get("add_fridge_item")!({ name: "Skyr", quantity: "2", category: "dairy", expiryDate: "2026-10-30" });
    expect(calls[0].method).toBe("POST");
    expect(calls[0].body.name).toBe("Skyr");
  });

  it("get_shopping_list lists items", async () => {
    wire();
    stubFetch({ "/shopping-list": { data: { id: "l1", name: "Lista", items: [{ id: "i1", name: "Mleko", isCompleted: false }] } } });
    const out = await handlers.get("get_shopping_list")!({});
    expect(out.content[0].text).toContain("Mleko");
  });

  it("update_shopping_item ticks an item off", async () => {
    wire();
    stubFetch({ "/shopping-list/items/i1": { id: "i1", isCompleted: true } });
    const out = await handlers.get("update_shopping_item")!({ id: "i1", isCompleted: true });
    expect(calls[0].method).toBe("PUT");
    expect(out.content[0].text).toContain('"completed":true');
  });
});

describe("tool registry", () => {
  it("registers every advertised tool exactly once", () => {
    wire();
    const names = [...handlers.keys()];
    expect(new Set(names).size).toBe(names.length);
    for (const name of [
      "get_diet_plans",
      "get_diet_plan",
      "generate_diet_plan",
      "get_recipe_tags",
      "get_public_recipe",
      "find_recipes_for_remaining_macros",
      "suggest_meal",
      "get_profile",
      "get_coach_plan",
      "get_dashboard_summary",
      "get_nutrition_stats",
      "get_activity_stats",
      "get_measurement_stats",
      "get_goal_progress",
      "get_personal_records",
      "get_exercise_history",
      "get_muscle_activation",
      "get_fridge",
      "get_shopping_list",
    ]) {
      expect(names).toContain(name);
    }
  });
});

