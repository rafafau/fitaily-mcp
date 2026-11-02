import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { fitailyGet, fitailySend } from "../api/fitaily-client";
import type { McpAuth } from "../auth/verify";
import { requireScope } from "../auth/verify";
import {
  ProgressSummaryInput,
  MeasurementHistoryInput,
  AddMeasurementInput,
  AddGoalInput,
  UpdateGoalInput,
} from "../schemas/common";

export function registerProgressTools(server: McpServer, auth: McpAuth, accessToken: string): void {
  server.registerTool(
    "get_progress_summary",
    {
      description: "Weight trend and latest measurement. Defaults to the last 30 days.",
      inputSchema: ProgressSummaryInput,
      annotations: { readOnlyHint: true },
    },
    async (input) => {
      requireScope(auth, "progress:read");
      const to = input.to || new Date().toISOString().slice(0, 10);
      const from = input.from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const [trends, latest] = await Promise.all([
        fitailyGet<any>(accessToken, "/measurements/trends", { startDate: from, endDate: to }).catch(() => ({
          trends: [],
        })),
        fitailyGet<any>(accessToken, "/measurements/latest").catch(() => null),
      ]);
      const points = trends.trends || trends || [];
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              from,
              to,
              weight_kg: (Array.isArray(points) ? points : [])
                .map((p: any) => ({ date: p.date, weight: p.weight }))
                .filter((p: any) => p.weight != null),
              latest_weight_kg: latest?.weight ?? null,
              latest_date: latest?.date ?? null,
            }),
          },
        ],
      };
    },
  );

  server.registerTool(
    "get_measurement_history",
    {
      description: "Body measurements (weight, body fat, muscle, circumferences) over a range.",
      inputSchema: MeasurementHistoryInput,
      annotations: { readOnlyHint: true },
    },
    async (input) => {
      requireScope(auth, "progress:read");
      const params: Record<string, string | number | undefined> = { limit: input.limit ?? 30 };
      if (input.from) params.startDate = input.from;
      if (input.to) params.endDate = input.to;
      const res = await fitailyGet<any>(accessToken, "/measurements", params);
      const list = Array.isArray(res) ? res : res.measurements || res.items || res.entries || [];
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              measurements: (list as any[]).slice(0, input.limit ?? 30).map((m: any) => ({
                id: m.id,
                date: m.date,
                weight_kg: m.weight ?? null,
                body_fat_pct: m.bodyFat ?? null,
                muscle_kg: m.muscleMassKg ?? m.muscleMass ?? null,
              })),
            }),
          },
        ],
      };
    },
  );

  server.registerTool(
    "get_goals",
    {
      description: "User goals with current vs target values.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    async () => {
      requireScope(auth, "progress:read");
      const res = await fitailyGet<any>(accessToken, "/goals", {});
      const list = Array.isArray(res) ? res : res.goals || res.items || [];
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              goals: (list as any[]).map((g: any) => ({
                id: g.id,
                type: g.type,
                name: g.name,
                current: g.currentValue ?? null,
                target: g.targetValue,
                unit: g.unit ?? null,
                active: g.isActive,
                completed: g.isCompleted,
              })),
            }),
          },
        ],
      };
    },
  );

  server.registerTool(
    "add_measurement",
    {
      description: "WRITE: log a body measurement (weight and/or composition). Confirm with the user first.",
      inputSchema: AddMeasurementInput,
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (input) => {
      requireScope(auth, "progress:write");
      const created = await fitailySend<any>(accessToken, "POST", "/measurements", input);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ id: (created as any).id ?? null, date: (created as any).date ?? null }),
          },
        ],
      };
    },
  );

  server.registerTool(
    "add_goal",
    {
      description: "WRITE: create a goal (weight, workouts, custom). Confirm with the user first.",
      inputSchema: AddGoalInput,
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (input) => {
      requireScope(auth, "progress:write");
      const created = await fitailySend<any>(accessToken, "POST", "/goals", input);
      return {
        content: [{ type: "text", text: JSON.stringify({ id: (created as any).id ?? null, name: input.name }) }],
      };
    },
  );

  server.registerTool(
    "update_goal",
    {
      description: "WRITE: update a goal (values, completion). Confirm with the user first.",
      inputSchema: UpdateGoalInput,
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (input) => {
      requireScope(auth, "progress:write");
      const { id, ...patch } = input;
      const updated = await fitailySend<any>(accessToken, "PUT", `/goals/${id}`, patch);
      return {
        content: [{ type: "text", text: JSON.stringify({ id: (updated as any).id ?? id }) }],
      };
    },
  );
}
