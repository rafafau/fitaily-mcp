import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { fitailyGet, fitailySend } from "../api/fitaily-client";
import type { McpAuth } from "../auth/verify";
import { requireScope } from "../auth/verify";
import {
  NutritionStatsInput,
  ActivityStatsInput,
  MeasurementStatsInput,
  ForecastInput,
} from "../schemas/common";
import { resolvePeriod } from "../utils/dates";

function round(value: unknown, digits = 1): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value * 10 ** digits) / 10 ** digits
    : null;
}

/**
 * Period aggregates (nutrition / activity / measurements).
 * Separate from the raw history tools: these answer "how did the week go".
 */
export function registerStatsTools(server: McpServer, auth: McpAuth, accessToken: string): void {
  server.registerTool(
    "get_nutrition_stats",
    {
      description:
        "Nutrition aggregates over a period: totals, daily averages, entries per meal type and how many days hit the calorie goal. Defaults to the last 30 days.",
      inputSchema: NutritionStatsInput,
      annotations: { readOnlyHint: true },
    },
    async (input) => {
      requireScope(auth, "nutrition:read");
      const { from, to } = resolvePeriod(input.from, input.to);
      const stats = await fitailyGet<any>(accessToken, "/nutrition/stats", {
        startDate: from,
        endDate: to,
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              from,
              to,
              totals: stats?.totals ?? null,
              average_per_day: stats?.averagePerDay ?? null,
              by_meal_type: stats?.byMealType ?? null,
              entry_count: stats?.entryCount ?? null,
            }),
          },
        ],
      };
    },
  );

  server.registerTool(
    "get_activity_stats",
    {
      description:
        "Activity aggregates over a period: total duration, calories burned, distance and a per-type breakdown. Defaults to the last 30 days.",
      inputSchema: ActivityStatsInput,
      annotations: { readOnlyHint: true },
    },
    async (input) => {
      requireScope(auth, "training:read");
      const { from, to } = resolvePeriod(input.from, input.to);
      const stats = await fitailyGet<any>(accessToken, "/activity/stats", {
        startDate: from,
        endDate: to,
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              from,
              to,
              totals: stats?.totals ?? null,
              by_type: stats?.byType ?? null,
              average_per_day: stats?.averagePerDay ?? null,
            }),
          },
        ],
      };
    },
  );

  server.registerTool(
    "get_measurement_stats",
    {
      description:
        "Body measurement aggregates over a period: min/max/average/first/latest for weight, body fat, muscle mass and BMI. Defaults to the last 30 days.",
      inputSchema: MeasurementStatsInput,
      annotations: { readOnlyHint: true },
    },
    async (input) => {
      requireScope(auth, "progress:read");
      const { from, to } = resolvePeriod(input.from, input.to);
      const stats = await fitailyGet<any>(accessToken, "/measurements/stats", {
        startDate: from,
        endDate: to,
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              from,
              to,
              count: stats?.count ?? null,
              weight_kg: stats?.weight ?? null,
              body_fat_pct: stats?.bodyFat ?? null,
              muscle_kg: stats?.muscleMass ?? null,
              bmi: stats?.bmi ?? null,
            }),
          },
        ],
      };
    },
  );

  server.registerTool(
    "get_goal_progress",
    {
      description:
        "Progress of every active goal (weight, workouts, custom): current vs target, percent complete and whether it is on track. Nutrition goals are excluded — use get_nutrition_goals.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    async () => {
      requireScope(auth, "progress:read");
      const [progressRes, goalsRes] = await Promise.all([
        fitailyGet<any>(accessToken, "/goals/progress"),
        fitailyGet<any>(accessToken, "/goals"),
      ]);
      const progressList: any[] = Array.isArray(progressRes)
        ? progressRes
        : (progressRes?.goals ?? []);
      const goalList: any[] = Array.isArray(goalsRes)
        ? goalsRes
        : (goalsRes?.goals ?? goalsRes?.items ?? []);
      const byId = new Map<string, any>(
        goalList.map((g) => [String(g.id), g]),
      );

      const goals = progressList.map((p) => {
        const goal = byId.get(String(p.goalId)) ?? {};
        return {
          id: p.goalId ?? null,
          type: goal.type ?? null,
          name: goal.name ?? null,
          current: round(goal.currentValue, 2),
          target: round(goal.targetValue, 2),
          unit: goal.unit ?? null,
          remaining: round(p.remaining, 2),
          percent: round(p.percentComplete, 1),
          on_track: p.isOnTrack ?? null,
          days_remaining: p.daysRemaining ?? null,
          target_date: goal.targetDate ?? null,
        };
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ count: goals.length, goals }),
          },
        ],
      };
    },
  );

  server.registerTool(
    "get_forecast",
    {
      description:
        "TimesFM time-series forecast for one metric (weight, body fat, muscle, activity, food macros). Returns daily points with confidence bands. Needs enough history (metric-specific minimum) and is limited to 10 requests/minute; results are cached for 6h. Use it only when the user asks about the future (e.g. 'when will I reach my target weight'), not for current values.",
      inputSchema: ForecastInput,
      annotations: { readOnlyHint: true },
    },
    async (input) => {
      requireScope(auth, "progress:read");
      const res = await fitailySend<any>(accessToken, "POST", "/predictions/forecast", {
        metric: input.metric,
        predictionDays: input.predictionDays ?? 14,
      });
      const forecast: any[] = res?.forecast ?? [];
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              metric: res?.metric ?? input.metric,
              unit: res?.unit ?? null,
              engine: res?.engineType ?? null,
              forecast: forecast.map((p) => ({
                date: p.date ?? null,
                value: round(p.value, 2),
                lower: round(p.confidenceLower, 2),
                upper: round(p.confidenceUpper, 2),
              })),
            }),
          },
        ],
      };
    },
  );
}
