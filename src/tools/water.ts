import type { McpServer } from "@modelcontextprotocol/server";
import { fitailyGet, fitailySend } from "../api/fitaily-client.js";
import { z } from "zod";
import { listOf, type CreatedEntity, type WaterEntry } from "../api/types.js";
import type { McpAuth } from "../auth/verify.js";
import { requireScope } from "../auth/verify.js";
import { WaterHistoryInput, LogWaterInput, DeleteWaterInput } from "../schemas/common.js";
import { JsonObjectOutput, jsonResult } from "../utils/result.js";

export function registerWaterTools(server: McpServer, auth: McpAuth, accessToken: string): void {
  server.registerTool(
    "get_water_history",
    {
      description: "Water intake entries over a date range.",
      inputSchema: WaterHistoryInput,
      outputSchema: JsonObjectOutput,
      annotations: { readOnlyHint: true },
    },
    async (input: z.infer<typeof WaterHistoryInput>) => {
      requireScope(auth, "nutrition:read");
      const params: Record<string, string | number | undefined> = { limit: input.limit ?? 30 };
      if (input.from) params.startDate = input.from;
      if (input.to) params.endDate = input.to;
      const res = await fitailyGet<unknown>(accessToken, "/water/history", params);
      const list = listOf<WaterEntry>(res, "entries", "items", "history");
      return jsonResult({
        entries: list.slice(0, input.limit ?? 30).map((e) => ({
          id: e.id,
          amount_ml: e.amount,
          date: e.date || e.createdAt || null,
        })),
      });
    },
  );

  server.registerTool(
    "log_water",
    {
      description: "WRITE: log water intake in milliliters. Confirm with the user first.",
      inputSchema: LogWaterInput,
      outputSchema: JsonObjectOutput,
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (input: z.infer<typeof LogWaterInput>) => {
      requireScope(auth, "nutrition:write");
      const created = await fitailySend<CreatedEntity>(accessToken, "POST", "/water/log", {
        amount: input.amountMl,
        timestamp: input.date,
      });
      return jsonResult({ id: created.id ?? null, amount_ml: input.amountMl });
    },
  );

  server.registerTool(
    "delete_water_entry",
    {
      description: "WRITE: delete a water entry by id. Confirm with the user first.",
      inputSchema: DeleteWaterInput,
      outputSchema: JsonObjectOutput,
      annotations: { destructiveHint: true },
    },
    async (input: z.infer<typeof DeleteWaterInput>) => {
      requireScope(auth, "nutrition:write");
      await fitailySend(accessToken, "DELETE", `/water/${input.id}`);
      return jsonResult({ deleted: input.id });
    },
  );
}
