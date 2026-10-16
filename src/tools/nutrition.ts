import type { McpServer } from "@modelcontextprotocol/server";
import { fitailyGet } from "../api/fitaily-client";
import type { McpAuth } from "../auth/verify";
import { requireScope } from "../auth/verify";
import { TodayNutritionInput } from "../schemas/common";

interface DaySummary {
  date: string;
  consumed?: { calories?: number; protein?: number; carbs?: number; fat?: number };
  goals?: { calories?: number; protein?: number; carbs?: number; fat?: number };
  remaining?: { calories?: number; protein?: number; carbs?: number; fat?: number };
  water?: { total?: number; goal?: number };
}

/** GET /api/nutrition/day-summary — calories/macros/water for one day. */
export function registerNutritionTools(server: McpServer, auth: McpAuth, accessToken: string): void {
  server.registerTool(
    "get_today_nutrition",
    {
      description: "Daily nutrition: consumed calories/macros, goals and remaining budget. Defaults to today.",
      inputSchema: TodayNutritionInput,
    },
    async (input) => {
      requireScope(auth, "nutrition:read");
      const day = await fitailyGet<DaySummary>(accessToken, "/nutrition/day-summary", input.date ? { date: input.date } : {});
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
            }),
          },
        ],
      };
    },
  );
}
