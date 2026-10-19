import type { McpServer } from "@modelcontextprotocol/server";
import { fitailyGet } from "../api/fitaily-client";
import type { McpAuth } from "../auth/verify";
import { requireScope } from "../auth/verify";
import { FoodSearchInput, BarcodeInput } from "../schemas/common";

/** Product catalog search — macros first, so add_meal never invents numbers. */
export function registerFoodTools(server: McpServer, auth: McpAuth, accessToken: string): void {
  server.registerTool(
    "search_foods",
    {
      description:
        "Search the food catalog by name (per-100g macros, servings). Call this before add_meal when the user names a product instead of giving macros.",
      inputSchema: FoodSearchInput,
      annotations: { readOnlyHint: true },
    },
    async (input) => {
      requireScope(auth, "nutrition:read");
      const res = await fitailyGet<any>(accessToken, "/products", {
        search: input.query,
        limit: input.limit ?? 10,
      });
      const list = Array.isArray(res) ? res : res.products || res.items || res.entries || [];
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              products: (list as any[]).slice(0, input.limit ?? 10).map((p: any) => ({
                id: p.id,
                name: p.name,
                brand: p.brand ?? null,
                barcode: p.barcode ?? null,
                per_100g: {
                  kcal: p.caloriesPer100 ?? p.calories ?? null,
                  protein_g: p.proteinPer100 ?? p.protein ?? null,
                  carbs_g: p.carbsPer100 ?? p.carbs ?? null,
                  fat_g: p.fatPer100 ?? p.fat ?? null,
                },
                serving: p.servingSize ? { size: p.servingSize, unit: p.servingUnit ?? null } : undefined,
              })),
            }),
          },
        ],
      };
    },
  );

  server.registerTool(
    "get_food_by_barcode",
    {
      description: "Look up a product by barcode (per-100g macros).",
      inputSchema: BarcodeInput,
      annotations: { readOnlyHint: true },
    },
    async (input) => {
      requireScope(auth, "nutrition:read");
      const p = await fitailyGet<any>(accessToken, `/products/barcode/${encodeURIComponent(input.code)}`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              id: p.id,
              name: p.name,
              brand: p.brand ?? null,
              per_100g: {
                kcal: p.caloriesPer100 ?? null,
                protein_g: p.proteinPer100 ?? null,
                carbs_g: p.carbsPer100 ?? null,
                fat_g: p.fatPer100 ?? null,
              },
            }),
          },
        ],
      };
    },
  );
}
