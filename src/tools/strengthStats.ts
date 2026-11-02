import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { fitailyGet } from "../api/fitaily-client";
import type { McpAuth } from "../auth/verify";
import { requireScope } from "../auth/verify";
import { ExerciseHistoryInput, MuscleActivationInput } from "../schemas/common";
import { daysAgo } from "../utils/dates";

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
      description:
        "All current personal records (1RM, max weight, max reps, max volume, best time) with the previous value so you can show the delta.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    async () => {
      requireScope(auth, "training:read");
      const res = await fitailyGet<any>(accessToken, "/exercises/records/all");
      const list: any[] = Array.isArray(res) ? res : (res?.records ?? []);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              count: list.length,
              records: list.map((r) => ({
                exercise_id: r.exerciseId ?? null,
                exercise: r.exerciseName ?? null,
                type: r.recordType ?? null,
                value: round(r.value, 2),
                unit: r.unit ?? null,
                reps: r.reps ?? null,
                weight_kg: round(r.weight, 2),
                previous_value: round(r.previousValue, 2),
                achieved_at: r.achievedAt ?? null,
              })),
            }),
          },
        ],
      };
    },
  );

  server.registerTool(
    "get_exercise_history",
    {
      description:
        "Completed sets of one exercise over the last N months (default 12, max 24), newest first — use it to judge progression before recommending loads.",
      inputSchema: ExerciseHistoryInput,
      annotations: { readOnlyHint: true },
    },
    async (input) => {
      requireScope(auth, "training:read");
      const res = await fitailyGet<any>(
        accessToken,
        `/workouts/exercise-history/${encodeURIComponent(input.exerciseId)}`,
        { months: input.months ?? 12 },
      );
      const sessions: any[] = Array.isArray(res) ? res : (res?.sessions ?? []);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              exercise_id: input.exerciseId,
              months: input.months ?? 12,
              sessions: sessions.map((s) => ({
                date: s.date ?? s.workoutDate ?? null,
                workout: s.workoutName ?? null,
                sets: (s.sets ?? []).map((set: any) => ({
                  reps: set.reps ?? null,
                  weight_kg: round(set.weight, 2),
                  time_s: set.time ?? null,
                  one_rm: round(set.estimated1RM, 1),
                  pr: set.isPersonalRecord ?? null,
                })),
                max_weight_kg: round(s.maxWeight, 2),
                total_reps: s.totalReps ?? null,
                volume_kg: round(s.sessionVolume ?? s.totalVolume, 1),
                best_set_volume: round(s.bestSetVolume, 1),
                best_one_rm: round(s.best1RM, 1),
              })),
            }),
          },
        ],
      };
    },
  );

  server.registerTool(
    "get_muscle_activation",
    {
      description:
        "Completed sets per exercise since a date (default 30 days), for balance analysis: which muscles were trained and which were neglected.",
      inputSchema: MuscleActivationInput,
      annotations: { readOnlyHint: true },
    },
    async (input) => {
      requireScope(auth, "training:read");
      const since = input.since ?? daysAgo(30);
      const res = await fitailyGet<any>(accessToken, "/workouts/muscle-activation", {
        since,
      });
      const exercises: any[] = Array.isArray(res) ? res : (res?.exercises ?? []);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              since,
              exercises: exercises.map((e) => ({
                exercise_id: e.exerciseId ?? null,
                name: e.name ?? null,
                category: e.category ?? null,
                muscle_group: e.muscleGroup ?? null,
                completed_sets: e.completedSets ?? 0,
              })),
            }),
          },
        ],
      };
    },
  );
}
