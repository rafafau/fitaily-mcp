import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { fitailyGet, fitailySend } from "../api/fitaily-client.js";
import {
  listOf,
  type ActivityStats,
  type Forecast,
  type Goal,
  type GoalProgress,
  type MeasurementStats,
  type MetricTrend,
  type NutritionHistoryRow,
  type NutritionStats,
} from "../api/types.js";
import type { McpAuth } from "../auth/verify.js";
import { requireScope } from "../auth/verify.js";
import {
  NutritionStatsInput,
  ActivityStatsInput,
  MeasurementStatsInput,
  NutritionHistoryInput,
  MetricTrendInput,
  ForecastInput,
} from "../schemas/common.js";
import { resolvePeriod } from "../utils/dates.js";
import { JsonObjectOutput, jsonResult } from "../utils/result.js";

function round(value: unknown, digits = 1): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value * 10 ** digits) / 10 ** digits : null;
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
      outputSchema: JsonObjectOutput,
      annotations: { readOnlyHint: true },
    },
    async (input: z.infer<typeof NutritionStatsInput>) => {
      requireScope(auth, "nutrition:read");
      const { from, to } = resolvePeriod(input.from, input.to);
      const stats = await fitailyGet<NutritionStats>(accessToken, "/nutrition/stats", {
        startDate: from,
        endDate: to,
      });
      return jsonResult({
        from,
        to,
        totals: stats?.totals ?? null,
        average_per_day: stats?.averagePerDay ?? null,
        by_meal_type: stats?.byMealType ?? null,
        entry_count: stats?.entryCount ?? null,
      });
    },
  );

  server.registerTool(
    "get_activity_stats",
    {
      description:
        "Activity aggregates over a period: total duration, calories burned, distance and a per-type breakdown. Defaults to the last 30 days.",
      inputSchema: ActivityStatsInput,
      outputSchema: JsonObjectOutput,
      annotations: { readOnlyHint: true },
    },
    async (input: z.infer<typeof ActivityStatsInput>) => {
      requireScope(auth, "training:read");
      const { from, to } = resolvePeriod(input.from, input.to);
      const stats = await fitailyGet<ActivityStats>(accessToken, "/activity/stats", {
        startDate: from,
        endDate: to,
      });
      return jsonResult({
        from,
        to,
        totals: stats?.totals ?? null,
        by_type: stats?.byType ?? null,
        average_per_day: stats?.averagePerDay ?? null,
      });
    },
  );

  server.registerTool(
    "get_measurement_stats",
    {
      description:
        "Body measurement aggregates over a period: min/max/average/first/latest for weight, body fat, muscle mass and BMI. Defaults to the last 30 days.",
      inputSchema: MeasurementStatsInput,
      outputSchema: JsonObjectOutput,
      annotations: { readOnlyHint: true },
    },
    async (input: z.infer<typeof MeasurementStatsInput>) => {
      requireScope(auth, "progress:read");
      const { from, to } = resolvePeriod(input.from, input.to);
      const stats = await fitailyGet<MeasurementStats>(accessToken, "/measurements/stats", {
        startDate: from,
        endDate: to,
      });
      return jsonResult({
        from,
        to,
        count: stats?.count ?? null,
        weight_kg: stats?.weight ?? null,
        body_fat_pct: stats?.bodyFat ?? null,
        muscle_kg: stats?.muscleMass ?? null,
        bmi: stats?.bmi ?? null,
      });
    },
  );

  server.registerTool(
    "get_goal_progress",
    {
      description:
        "Progress of every active goal (weight, workouts, custom): current vs target, percent complete and whether it is on track. Nutrition goals are excluded — use get_nutrition_goals.",
      inputSchema: z.object({}),
      outputSchema: JsonObjectOutput,
      annotations: { readOnlyHint: true },
    },
    async () => {
      requireScope(auth, "progress:read");
      const [progressRes, goalsRes] = await Promise.all([
        fitailyGet<GoalProgress[] | { goals?: GoalProgress[] }>(accessToken, "/goals/progress"),
        fitailyGet<Goal[] | { goals?: Goal[] }>(accessToken, "/goals"),
      ]);
      const progressList = listOf<GoalProgress>(progressRes, "goals");
      const goalList = listOf<Goal>(goalsRes, "goals", "items");
      const byId = new Map(goalList.map((g) => [String(g.id), g]));

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

      return jsonResult({ count: goals.length, goals });
    },
  );

  server.registerTool(
    "query_nutrition_history",
    {
      description:
        "Meals aggregated by product over a period: how many times it was eaten and the average calories/macros per occurrence. Answers 'what do I eat most often' without listing every entry.",
      inputSchema: NutritionHistoryInput,
      outputSchema: JsonObjectOutput,
      annotations: { readOnlyHint: true },
    },
    async (input: z.infer<typeof NutritionHistoryInput>) => {
      requireScope(auth, "nutrition:read");
      const res = await fitailyGet<NutritionHistoryRow[] | { items?: NutritionHistoryRow[] }>(
        accessToken,
        "/stats/nutrition-history",
        {
          startDate: input.from,
          endDate: input.to,
          mealType: input.mealType,
        },
      );
      const rows = listOf<NutritionHistoryRow>(res, "items");
      const limit = input.limit ?? 20;
      return jsonResult({
        from: input.from,
        to: input.to,
        meal_type: input.mealType ?? null,
        products: rows.slice(0, limit).map((row) => ({
          food: row.foodName ?? null,
          barcode: row.productBarcode ?? null,
          times: row.occurrences ?? 0,
          avg_kcal: round(row.avgCalories, 0),
          avg_protein_g: round(row.avgProtein, 1),
          avg_carbs_g: round(row.avgCarbs, 1),
          avg_fat_g: round(row.avgFat, 1),
        })),
      });
    },
  );

  server.registerTool(
    "get_metric_trend",
    {
      description:
        "Daily series for one metric: measurements (weight/bodyFat/bmi/muscleMass), nutrition (calories/protein/carbs/fat), workouts (duration/burnedCalories) or hydration (amount). Returns points, delta and start/end values — ideal for a trend summary or a chart.",
      inputSchema: MetricTrendInput,
      outputSchema: JsonObjectOutput,
      annotations: { readOnlyHint: true },
    },
    async (input: z.infer<typeof MetricTrendInput>) => {
      requireScope(auth, "progress:read");
      const { from, to } = resolvePeriod(input.from, input.to);
      const trend = await fitailyGet<MetricTrend>(accessToken, "/stats/metric-trend", {
        category: input.category,
        metric: input.metric,
        startDate: from,
        endDate: to,
      });
      return jsonResult({
        category: trend?.category ?? input.category,
        metric: trend?.metric ?? input.metric ?? null,
        unit: trend?.unit ?? null,
        points: Array.isArray(trend?.points) ? trend.points : [],
        delta: round(trend?.delta, 1),
        startValue: round(trend?.startValue, 2),
        endValue: round(trend?.endValue, 2),
      });
    },
  );

  server.registerTool(
    "get_forecast",
    {
      description:
        "TimesFM time-series forecast for one metric (weight, body fat, muscle, activity, food macros). Returns daily points with confidence bands. Needs enough history (metric-specific minimum) and is limited to 10 requests/minute; results are cached for 6h. Use it only when the user asks about the future (e.g. 'when will I reach my target weight'), not for current values.",
      inputSchema: ForecastInput,
      outputSchema: JsonObjectOutput,
      annotations: { readOnlyHint: true },
    },
    async (input: z.infer<typeof ForecastInput>) => {
      requireScope(auth, "progress:read");
      const res = await fitailySend<Forecast>(accessToken, "POST", "/predictions/forecast", {
        metric: input.metric,
        predictionDays: input.predictionDays ?? 14,
      });
      const forecast = res?.forecast ?? [];
      return jsonResult({
        metric: res?.metric ?? input.metric,
        unit: res?.unit ?? null,
        engine: res?.engineType ?? null,
        forecast: forecast.map((p) => ({
          date: p.date ?? null,
          value: round(p.value, 2),
          lower: round(p.confidenceLower, 2),
          upper: round(p.confidenceUpper, 2),
        })),
      });
    },
  );
}
