import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { fitailyGet, fitailySend } from "../api/fitaily-client.js";
import { listOf, type CreatedEntity, type Goal, type Measurement, type TrendPoint } from "../api/types.js";
import type { McpAuth } from "../auth/verify.js";
import { requireScope } from "../auth/verify.js";
import {
  ProgressSummaryInput,
  MeasurementHistoryInput,
  AddMeasurementInput,
  AddGoalInput,
  UpdateGoalInput,
} from "../schemas/common.js";
import { JsonObjectOutput, jsonResult } from "../utils/result.js";
import { convertWeight, getUserUnits, isImperial } from "../utils/units.js";

export function registerProgressTools(server: McpServer, auth: McpAuth, accessToken: string): void {
  server.registerTool(
    "get_progress_summary",
    {
      title: "Progress summary",
      description: "Weight trend and latest measurement. Defaults to the last 30 days.",
      inputSchema: ProgressSummaryInput,
      outputSchema: JsonObjectOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (input: z.infer<typeof ProgressSummaryInput>) => {
      requireScope(auth, "progress:read");
      const to = input.to || new Date().toISOString().slice(0, 10);
      const from = input.from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const [trends, latest] = await Promise.all([
        fitailyGet<{ trends?: TrendPoint[] }>(accessToken, "/measurements/trends", {
          startDate: from,
          endDate: to,
        }).catch(() => ({
          trends: [],
        })),
        fitailyGet<Measurement | null>(accessToken, "/measurements/latest").catch(() => null),
      ]);
      const units = await getUserUnits(accessToken);
      const imperial = isImperial(units);
      return jsonResult({
        from,
        to,
        units,
        weight_kg: (trends.trends ?? [])
          .map((p) => ({ date: p.date, weight: p.weight }))
          .filter((p) => p.weight != null),
        weight_lbs: imperial
          ? (trends.trends ?? [])
              .map((p) => ({ date: p.date, weight: convertWeight(p.weight, true) }))
              .filter((p) => p.weight != null)
          : null,
        latest_weight_kg: latest?.weight ?? null,
        latest_weight_lbs: imperial ? convertWeight(latest?.weight ?? null, true) : null,
        latest_date: latest?.date ?? null,
      });
    },
  );

  server.registerTool(
    "get_measurement_history",
    {
      title: "Measurement history",
      description: "Body measurements (weight, body fat, muscle, circumferences) over a range.",
      inputSchema: MeasurementHistoryInput,
      outputSchema: JsonObjectOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (input: z.infer<typeof MeasurementHistoryInput>) => {
      requireScope(auth, "progress:read");
      const params: Record<string, string | number | undefined> = { limit: input.limit ?? 30 };
      if (input.from) params.startDate = input.from;
      if (input.to) params.endDate = input.to;
      const res = await fitailyGet<unknown>(accessToken, "/measurements", params);
      const list = listOf<Measurement>(res, "measurements", "items", "entries");
      const units = await getUserUnits(accessToken);
      const imperial = isImperial(units);
      return jsonResult({
        measurements: list.slice(0, input.limit ?? 30).map((m) => ({
          id: m.id,
          date: m.date,
          weight_kg: m.weight ?? null,
          weight_lbs: imperial ? convertWeight(m.weight ?? null, true) : null,
          body_fat_pct: m.bodyFat ?? null,
          muscle_kg: m.muscleMassKg ?? m.muscleMass ?? null,
        })),
      });
    },
  );

  server.registerTool(
    "get_goals",
    {
      title: "Progress goals",
      description: "User goals with current vs target values.",
      inputSchema: z.object({}),
      outputSchema: JsonObjectOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async () => {
      requireScope(auth, "progress:read");
      const res = await fitailyGet<unknown>(accessToken, "/goals", {});
      const list = listOf<Goal>(res, "goals", "items");
      return jsonResult({
        goals: list.map((g) => ({
          id: g.id,
          type: g.type,
          name: g.name,
          current: g.currentValue ?? null,
          target: g.targetValue,
          unit: g.unit ?? null,
          active: g.isActive,
          completed: g.isCompleted,
        })),
      });
    },
  );

  server.registerTool(
    "add_measurement",
    {
      title: "Log a measurement",
      description: "WRITE: log a body measurement (weight and/or composition). Confirm with the user first.",
      inputSchema: AddMeasurementInput,
      outputSchema: JsonObjectOutput,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (input: z.infer<typeof AddMeasurementInput>) => {
      requireScope(auth, "progress:write");
      const created = await fitailySend<CreatedEntity>(accessToken, "POST", "/measurements", input);
      return jsonResult({ id: created.id ?? null, date: created.date ?? null });
    },
  );

  server.registerTool(
    "add_goal",
    {
      title: "Add a goal",
      description: "WRITE: create a goal (weight, workouts, custom). Confirm with the user first.",
      inputSchema: AddGoalInput,
      outputSchema: JsonObjectOutput,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (input: z.infer<typeof AddGoalInput>) => {
      requireScope(auth, "progress:write");
      const created = await fitailySend<CreatedEntity>(accessToken, "POST", "/goals", input);
      return jsonResult({ id: created.id ?? null, name: input.name });
    },
  );

  server.registerTool(
    "update_goal",
    {
      title: "Update a goal",
      description: "WRITE: update a goal (values, completion). Confirm with the user first.",
      inputSchema: UpdateGoalInput,
      outputSchema: JsonObjectOutput,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (input: z.infer<typeof UpdateGoalInput>) => {
      requireScope(auth, "progress:write");
      const { id, ...patch } = input;
      const updated = await fitailySend<CreatedEntity>(accessToken, "PUT", `/goals/${id}`, patch);
      return jsonResult({ id: updated.id ?? id });
    },
  );
}
