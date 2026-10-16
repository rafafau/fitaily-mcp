import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { fitailyGet, fitailySend } from "../api/fitaily-client";
import type { McpAuth } from "../auth/verify";
import { requireScope } from "../auth/verify";
import { TrainingHistoryInput, LogActivityInput } from "../schemas/common";

/** Cardio/manual activities + plans. Strength sessions stay read-only
 * (single active-session guard + set structure don't fit chat). */
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
        fitailyGet<any>(accessToken, "/workouts", {}).catch(() => []),
      ]);
      const activityList = Array.isArray(activities) ? activities : (activities.entries || activities.activities || []);
      const workoutList = Array.isArray(workouts) ? workouts : (workouts.workouts || workouts.sessions || []);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              activities: activityList.slice(0, input.limit ?? 10).map((a: any) => ({
                id: a.id,
                date: a.date,
                type: a.type,
                name: a.name,
                distance_km: a.distance ?? null,
                duration_min: a.duration != null ? Math.round(Number(a.duration) / 60) : null,
                calories: a.caloriesBurned ?? null,
                avg_hr: a.averageHeartrate ?? null,
              })),
              strength_workouts: workoutList.slice(0, input.limit ?? 10).map((w: any) => ({
                id: w.id,
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

  server.registerTool(
    "get_training_plan",
    {
      description: "Planned training sessions (multi-sport plans and strength templates).",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(20).optional(),
      }),
    },
    async (input) => {
      requireScope(auth, "training:read");
      const [multi, strength] = await Promise.all([
        fitailyGet<any>(accessToken, "/training-plans", {}).catch(() => []),
        fitailyGet<any>(accessToken, "/workout-plans", {}).catch(() => []),
      ]);
      const norm = (v: any): any[] => (Array.isArray(v) ? v : v.plans || v.items || v.entries || []);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              multisport: norm(multi).map((p: any) => ({ id: p.id, name: p.name, description: p.description ?? null })),
              strength_templates: norm(strength).map((p: any) => ({ id: p.id, name: p.name, description: p.description ?? null })),
            }),
          },
        ],
      };
    },
  );

  server.registerTool(
    "log_activity",
    {
      description:
        "WRITE: log a simple cardio/manual activity (run, ride, walk). Confirm with the user first. Strength sessions cannot be created here — one active session per user plus set structure don't fit chat.",
      inputSchema: LogActivityInput,
    },
    async (input) => {
      requireScope(auth, "training:write");
      const created = await fitailySend<any>(accessToken, "POST", "/activity", {
        type: input.type,
        name: input.name,
        duration: input.durationMin * 60,
        distance: input.distanceKm,
        caloriesBurned: input.caloriesBurned,
        date: input.date,
      });
      return {
        content: [{ type: "text", text: JSON.stringify({ id: (created as any).id ?? null, name: input.name }) }],
      };
    },
  );
}
