import type { McpServer } from "@modelcontextprotocol/server";
import { fitailyGet } from "../api/fitaily-client";
import type { McpAuth } from "../auth/verify";
import { requireScope } from "../auth/verify";
import { RecipeSuggestionInput } from "../schemas/common";

/** Ranked recipe suggestions for the remaining budget — read-only discovery. */
export function registerRecipeTools(server: McpServer, auth: McpAuth, accessToken: string): void {
  server.registerTool(
    "get_recipe_suggestions",
    {
      description:
        "Recipe ideas ranked for the day's remaining calories (uses the same discovery as the app). Filter by meal type and max prep time.",
      inputSchema: RecipeSuggestionInput,
    },
    async (input) => {
      requireScope(auth, "nutrition:read");
      const res = await fitailyGet<any>(
        accessToken,
        "/recipes/discovery",
        input.date ? { date: input.date } : {},
      );
      const sections = res.sections || (Array.isArray(res) ? res : []);
      const limit = input.limit ?? 6;
      const out: any[] = [];
      for (const s of sections as any[]) {
        for (const r of s.items || []) {
          if (input.maxTimeMin != null && (r.durationMinutes ?? 9999) > input.maxTimeMin) continue;
          out.push({
            id: r.id,
            title: r.title,
            kcal: r.calories,
            protein_g: r.proteinGrams,
            carbs_g: r.carbsGrams,
            fat_g: r.fatGrams,
            time_min: r.durationMinutes ?? null,
            servings: r.servings,
            reason: r.reason ?? null,
            section: s.key,
          });
          if (out.length >= limit) break;
        }
        if (out.length >= limit) break;
      }
      return { content: [{ type: "text", text: JSON.stringify({ recipes: out }) }] };
    },
  );
}
