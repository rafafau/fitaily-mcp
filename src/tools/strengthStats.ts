import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { fitailyGet } from "../api/fitaily-client.js";
import {
  listOf,
  type ExerciseRecord,
  type ExerciseSession,
  type ExerciseSessionSet,
  type MuscleActivation,
} from "../api/types.js";
import type { McpAuth } from "../auth/verify.js";
import { requireScope } from "../auth/verify.js";
import { ExerciseHistoryInput, MuscleActivationInput } from "../schemas/common.js";
import { daysAgo } from "../utils/dates.js";
import { JsonObjectOutput, jsonResult } from "../utils/result.js";
import { convertWeight, getUserUnits, isImperial } from "../utils/units.js";

function round(value: unknown, digits = 1): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value * 10 ** digits) / 10 ** digits : null;
}

/**
 * Strength progress: personal records, per-exercise history and muscle load.
 * The backend aggregates completed sets — the model should not re-derive them.
 */
export function registerStrengthStatsTools(server: McpServer, auth: McpAuth, accessToken: string): void {
  server.registerTool(
    "get_personal_records",
    {
      title: "Personal records",
      description:
        "All current personal records (1RM, max weight, max reps, max volume, best time) with the previous value so you can show the delta.",
      inputSchema: z.object({}),
      outputSchema: JsonObjectOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async () => {
      requireScope(auth, "training:read");
      const res = await fitailyGet<ExerciseRecord[] | { records?: ExerciseRecord[] }>(
        accessToken,
        "/exercises/records/all",
      );
      const list = listOf<ExerciseRecord>(res, "records");
      const units = await getUserUnits(accessToken);
      const imperial = isImperial(units);
      return jsonResult({
        count: list.length,
        units,
        records: list.map((r) => ({
          exercise_id: r.exerciseId ?? null,
          exercise: r.exerciseName ?? null,
          type: r.recordType ?? null,
          value: round(r.value, 2),
          unit: r.unit ?? null,
          reps: r.reps ?? null,
          weight_kg: round(r.weight, 2),
          weight_lbs: imperial ? convertWeight(round(r.weight, 2), true) : null,
          previous_value: round(r.previousValue, 2),
          previous_value_lbs: imperial ? convertWeight(round(r.previousValue, 2), true) : null,
          achieved_at: r.achievedAt ?? null,
        })),
      });
    },
  );

  server.registerTool(
    "get_exercise_history",
    {
      title: "Exercise history",
      description:
        "Completed sets of one exercise over the last N months (default 12, max 24), newest first — use it to judge progression before recommending loads.",
      inputSchema: ExerciseHistoryInput,
      outputSchema: JsonObjectOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (input: z.infer<typeof ExerciseHistoryInput>) => {
      requireScope(auth, "training:read");
      const res = await fitailyGet<ExerciseSession[] | { sessions?: ExerciseSession[] }>(
        accessToken,
        `/workouts/exercise-history/${encodeURIComponent(input.exerciseId)}`,
        { months: input.months ?? 12 },
      );
      const sessions = listOf<ExerciseSession>(res, "sessions");
      const units = await getUserUnits(accessToken);
      const imperial = isImperial(units);
      return jsonResult({
        exercise_id: input.exerciseId,
        months: input.months ?? 12,
        units,
        sessions: sessions.map((s) => ({
          date: s.date ?? s.workoutDate ?? null,
          workout: s.workoutName ?? null,
          sets: (s.sets ?? []).map((set: ExerciseSessionSet) => ({
            reps: set.reps ?? null,
            weight_kg: round(set.weight, 2),
            weight_lbs: imperial ? convertWeight(round(set.weight, 2), true) : null,
            time_s: set.time ?? null,
            one_rm: round(set.estimated1RM, 1),
            one_rm_lbs: imperial ? convertWeight(round(set.estimated1RM, 1), true) : null,
            pr: set.isPersonalRecord ?? null,
          })),
          max_weight_kg: round(s.maxWeight, 2),
          max_weight_lbs: imperial ? convertWeight(round(s.maxWeight, 2), true) : null,
          total_reps: s.totalReps ?? null,
          volume_kg: round(s.sessionVolume ?? s.totalVolume, 1),
          volume_lbs: imperial ? convertWeight(round(s.sessionVolume ?? s.totalVolume, 1), true) : null,
          best_set_volume_kg: round(s.bestSetVolume, 1),
          best_set_volume_lbs: imperial ? convertWeight(round(s.bestSetVolume, 1), true) : null,
          best_one_rm_kg: round(s.best1RM, 1),
          best_one_rm_lbs: imperial ? convertWeight(round(s.best1RM, 1), true) : null,
        })),
      });
    },
  );

  server.registerTool(
    "get_muscle_activation",
    {
      title: "Muscle activation",
      description:
        "Completed sets per exercise since a date (default 30 days), for balance analysis: which muscles were trained and which were neglected.",
      inputSchema: MuscleActivationInput,
      outputSchema: JsonObjectOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (input) => {
      requireScope(auth, "training:read");
      const since = input.since ?? daysAgo(30);
      const res = await fitailyGet<MuscleActivation[] | { exercises?: MuscleActivation[] }>(
        accessToken,
        "/workouts/muscle-activation",
        {
          since,
        },
      );
      const exercises = listOf<MuscleActivation>(res, "exercises");
      return jsonResult({
        since,
        exercises: exercises.map((e) => ({
          exercise_id: e.exerciseId ?? null,
          name: e.name ?? null,
          category: e.category ?? null,
          muscle_group: e.muscleGroup ?? null,
          completed_sets: e.completedSets ?? 0,
        })),
      });
    },
  );
}
