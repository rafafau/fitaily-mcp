import type { McpServer } from "@modelcontextprotocol/server";
import { fitailyGet } from "../api/fitaily-client";
import type { McpAuth } from "../auth/verify";
import { requireScope } from "../auth/verify";
import { ProgressSummaryInput } from "../schemas/common";

/** GET /api/measurements/trends + /latest — weight trend only, no circumferences dump. */
export function registerProgressTools(server: McpServer, auth: McpAuth, accessToken: string): void {
  server.registerTool(
    "get_progress_summary",
    {
      description: "Weight trend and latest measurement. Defaults to the last 30 days.",
      inputSchema: ProgressSummaryInput,
    },
    async (input) => {
      requireScope(auth, "progress:read");
      const to = input.to || new Date().toISOString().slice(0, 10);
      const from = input.from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const [trends, latest] = await Promise.all([
        fitailyGet<any>(accessToken, "/measurements/trends", { startDate: from, endDate: to }).catch(() => ({ trends: [] })),
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
              weight_kg: (Array.isArray(points) ? points : []).map((p: any) => ({ date: p.date, weight: p.weight })).filter((p: any) => p.weight != null),
              latest_weight_kg: latest?.weight ?? null,
              latest_date: latest?.date ?? null,
            }),
          },
        ],
      };
    },
  );
}
