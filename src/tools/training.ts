import type { McpServer } from "@modelcontextprotocol/server";
import { fitailyGet } from "../api/fitaily-client";
import type { McpAuth } from "../auth/verify";
import { requireScope } from "../auth/verify";
import { TrainingHistoryInput } from "../schemas/common";

/** GET /api/activity + /api/workouts — recent cardio and strength sessions, trimmed. */
export function registerTrainingTools(server: McpServer, auth: McpAuth, accessToken: string): void {
  server.registerTool(
    "get_training_history",
    {
      description: "Recent activities and strength workouts (type, date, distance, duration). No per-second GPS.",
      inputSchema: TrainingHistoryInput,
    },
    async (input) => {
      requireScope(auth, "training:read");
      const params: Record<string, string | number | undefined> = { limit: input.limit ?? 10 };
      if (input.from) params.startDate = input.from;
      if (input.to) params.endDate = input.to;
      const [activities, workouts] = await Promise.all([
        fitailyGet<any>(accessToken, "/activity", params).catch(() => ({ entries: [] })),
        fitailyGet<any>(accessToken, "/workouts", input.from || input.to ? {} : {}).catch(() => []),
      ]);
      const activityList = Array.isArray(activities) ? activities : (activities.entries || activities.activities || []);
      const workoutList = Array.isArray(workouts) ? workouts : (workouts.workouts || workouts.sessions || []);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              activities: activityList.slice(0, input.limit ?? 10).map((a: any) => ({
                date: a.date,
                type: a.type,
                name: a.name,
                distance_km: a.distance ?? null,
                duration_min: a.duration != null ? Math.round(Number(a.duration) / 60) : null,
                calories: a.caloriesBurned ?? null,
              })),
              strength_workouts: workoutList.slice(0, input.limit ?? 10).map((w: any) => ({
                date: w.date || w.startTime,
                name: w.name,
                status: w.status,
                exercises: (w.exercises || []).map((e: any) => ({
                  name: e.exercise?.name || e.name,
                  sets: (e.sets || []).filter((s: any) => s.isCompleted).map((s: any) => ({ reps: s.reps, weight_kg: s.weight ?? null })),
                })),
              })),
            }),
          },
        ],
      };
    },
  );
}
