import type { McpServer } from "@modelcontextprotocol/server";
import { fitailyGet, fitailySend } from "../api/fitaily-client";
import type { McpAuth } from "../auth/verify";
import { requireScope } from "../auth/verify";
import { WaterHistoryInput, LogWaterInput, DeleteWaterInput } from "../schemas/common";

export function registerWaterTools(server: McpServer, auth: McpAuth, accessToken: string): void {
  server.registerTool(
    "get_water_history",
    {
      description: "Water intake entries over a date range.",
      inputSchema: WaterHistoryInput,
    },
    async (input) => {
      requireScope(auth, "nutrition:read");
      const params: Record<string, string | number | undefined> = { limit: input.limit ?? 30 };
      if (input.from) params.startDate = input.from;
      if (input.to) params.endDate = input.to;
      const res = await fitailyGet<any>(accessToken, "/water/history", params);
      const list = Array.isArray(res) ? res : res.entries || res.items || res.history || [];
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              entries: (list as any[]).slice(0, input.limit ?? 30).map((e: any) => ({
                id: e.id,
                amount_ml: e.amount,
                date: e.date || e.createdAt || null,
              })),
            }),
          },
        ],
      };
    },
  );

  server.registerTool(
    "log_water",
    {
      description: "WRITE: log water intake in milliliters. Confirm with the user first.",
      inputSchema: LogWaterInput,
    },
    async (input) => {
      requireScope(auth, "nutrition:write");
      const created = await fitailySend<any>(accessToken, "POST", "/water/log", {
        amount: input.amountMl,
        timestamp: input.date,
      });
      return {
        content: [{ type: "text", text: JSON.stringify({ id: (created as any).id ?? null, amount_ml: input.amountMl }) }],
      };
    },
  );

  server.registerTool(
    "delete_water_entry",
    {
      description: "WRITE: delete a water entry by id. Confirm with the user first.",
      inputSchema: DeleteWaterInput,
    },
    async (input) => {
      requireScope(auth, "nutrition:write");
      await fitailySend(accessToken, "DELETE", `/water/${input.id}`);
      return { content: [{ type: "text", text: JSON.stringify({ deleted: input.id }) }] };
    },
  );
}
