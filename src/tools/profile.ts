import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { fitailyGet } from "../api/fitaily-client.js";
import { type CoachProfile, type DashboardStats, type Measurement, type Profile } from "../api/types.js";
import type { McpAuth } from "../auth/verify.js";
import { requireScope } from "../auth/verify.js";
import { today } from "../utils/dates.js";
import { JsonObjectOutput, jsonResult } from "../utils/result.js";
import { cmToFtIn, convertWeight, isImperial } from "../utils/units.js";

/**
 * User context: profile, coach plan and dashboard headline numbers.
 * These three answer "who am I / what am I aiming at" before any tool call.
 */
export function registerProfileTools(server: McpServer, auth: McpAuth, accessToken: string): void {
  server.registerTool(
    "get_profile",
    {
      title: "Your Fitaily profile",
      description:
        "The user's profile: latest weight, height, age, sex, units, language, activity level, weight direction, target weight and current daily goals. Read this before giving calorie or macro advice.",
      inputSchema: z.object({}),
      outputSchema: JsonObjectOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async () => {
      requireScope(auth, "nutrition:read");
      const [profile, latest] = await Promise.all([
        fitailyGet<Profile>(accessToken, "/auth/me"),
        fitailyGet<Measurement | null>(accessToken, "/measurements/latest").catch(() => null),
      ]);
      const birthDate = profile?.dateOfBirth ? new Date(profile.dateOfBirth) : null;
      const age =
        birthDate && !Number.isNaN(birthDate.getTime())
          ? Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 86400000))
          : null;
      const units = profile?.units ?? "metric";
      const imperial = isImperial(units);
      return jsonResult({
        id: profile?.id ?? null,
        display_name: profile?.displayName ?? null,
        email: profile?.email ?? null,
        language: profile?.language ?? null,
        units,
        weight_kg: latest?.weight ?? null,
        weight_lbs: imperial ? convertWeight(latest?.weight ?? null, true) : null,
        weight_date: latest?.date ?? null,
        height_cm: profile?.height ?? null,
        height_ft_in: imperial ? cmToFtIn(profile?.height ?? null) : null,
        age,
        gender: profile?.gender ?? null,
        activity_level: profile?.activityLevel ?? null,
        weight_direction: profile?.weightDirection ?? null,
        target_weight_kg: profile?.targetWeight ?? null,
        target_weight_lbs: imperial ? convertWeight(profile?.targetWeight ?? null, true) : null,
        goals: {
          kcal: profile?.dailyCaloriesGoal ?? null,
          protein_g: profile?.proteinGoal ?? null,
          carbs_g: profile?.carbsGoal ?? null,
          fat_g: profile?.fatGoal ?? null,
        },
      });
    },
  );

  server.registerTool(
    "get_coach_plan",
    {
      title: "Adaptive coach plan",
      description:
        "The adaptive coach plan: goal, phase, target weekly rate, current calorie target, macro strategy, protein per kg and the effective daily goals. Returns active=false when the user never enabled the coach.",
      inputSchema: z.object({}),
      outputSchema: JsonObjectOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async () => {
      requireScope(auth, "nutrition:read");
      const profile = await fitailyGet<CoachProfile | null>(accessToken, "/coach/profile").catch(() => null);
      if (!profile) {
        return jsonResult({
          active: false,
          note: "Coach is not configured for this account. Use get_profile / get_nutrition_goals instead.",
        });
      }
      return jsonResult({
        active: profile.isActive ?? false,
        goal: profile.goal ?? null,
        phase: profile.phase ?? null,
        target_weekly_rate_kg: profile.targetWeeklyRateKg ?? null,
        current_calories: profile.currentCalories ?? null,
        baseline_calories: profile.baselineCalories ?? null,
        calorie_floor: profile.minCaloriesFloor ?? null,
        calorie_ceiling: profile.maxCaloriesCeiling ?? null,
        macro_strategy: profile.macroStrategy ?? null,
        protein_per_kg: profile.proteinPerKgBw ?? null,
        auto_calories: profile.autoCalories ?? null,
        effective_goals: profile.effectiveGoals ?? null,
        latest_prediction: Array.isArray(profile.dailyPredictions) ? (profile.dailyPredictions[0] ?? null) : null,
      });
    },
  );

  server.registerTool(
    "get_dashboard_summary",
    {
      title: "Fitaily dashboard",
      description:
        "One-shot overview for an opening answer: today's calories, workouts completed this week, latest weight and personal records set this month.",
      inputSchema: z.object({}),
      outputSchema: JsonObjectOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async () => {
      requireScope(auth, "nutrition:read");
      const stats = await fitailyGet<DashboardStats>(accessToken, "/dashboard/stats");
      return jsonResult({
        date: today(),
        today_calories: stats?.calories ?? null,
        workouts_this_week: stats?.workouts ?? null,
        latest_weight_kg: stats?.weight ?? null,
        records_this_month: stats?.records ?? null,
      });
    },
  );
}
