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
