import type { McpServer } from "@modelcontextprotocol/server";
import { fitailyGet } from "../api/fitaily-client.js";
import { z } from "zod";
import { listOf, type FoodProduct } from "../api/types.js";
import type { McpAuth } from "../auth/verify.js";
import { requireScope } from "../auth/verify.js";
import { FoodSearchInput, BarcodeInput } from "../schemas/common.js";
import { JsonObjectOutput, jsonResult } from "../utils/result.js";

/** Product catalog search — macros first, so add_meal never invents numbers. */
export function registerFoodTools(server: McpServer, auth: McpAuth, accessToken: string): void {
  server.registerTool(
    "search_foods",
    {
      title: "Search foods",
      description:
        "Search the food catalog by name (per-100g macros, servings). Call this before add_meal when the user names a product instead of giving macros.",
      inputSchema: FoodSearchInput,
      outputSchema: JsonObjectOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (input: z.infer<typeof FoodSearchInput>) => {
      requireScope(auth, "nutrition:read");
      const res = await fitailyGet<unknown>(accessToken, "/products", {
        search: input.query,
        limit: input.limit ?? 10,
      });
      const list = listOf<FoodProduct>(res, "products", "items", "entries");
      return jsonResult({
        products: list.slice(0, input.limit ?? 10).map((p) => ({
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
      });
    },
  );

  server.registerTool(
    "get_food_by_barcode",
    {
      title: "Find food by barcode",
      description: "Look up a product by barcode (per-100g macros).",
      inputSchema: BarcodeInput,
      outputSchema: JsonObjectOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (input: z.infer<typeof BarcodeInput>) => {
      requireScope(auth, "nutrition:read");
      const p = await fitailyGet<FoodProduct>(accessToken, `/products/barcode/${encodeURIComponent(input.code)}`);
      return jsonResult({
        id: p.id,
        name: p.name,
        brand: p.brand ?? null,
        per_100g: {
          kcal: p.caloriesPer100 ?? null,
          protein_g: p.proteinPer100 ?? null,
          carbs_g: p.carbsPer100 ?? null,
          fat_g: p.fatPer100 ?? null,
        },
      });
    },
  );
}
