import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { fitailyGet, fitailySend } from "../api/fitaily-client.js";
import { listOf, type FoodProduct } from "../api/types.js";
import type { McpAuth } from "../auth/verify.js";
import { requireScope } from "../auth/verify.js";
import {
  CreateMyProductInput,
  DeleteMyProductInput,
  ListMyProductsInput,
  UpdateMyProductInput,
} from "../schemas/common.js";
import { JsonObjectOutput, jsonResult } from "../utils/result.js";

function productSummary(product: FoodProduct): Record<string, unknown> {
  return {
    id: product.id ?? null,
    name: product.name ?? null,
    brand: product.brand ?? null,
    barcode: product.barcode ?? null,
    base_unit: product.baseUnit ?? null,
    per_100: {
      kcal: product.caloriesPer100 ?? product.calories ?? null,
      protein_g: product.proteinPer100 ?? product.protein ?? null,
      carbs_g: product.carbsPer100 ?? product.carbs ?? null,
      fat_g: product.fatPer100 ?? product.fat ?? null,
      sugar_g: product.sugarPer100 ?? null,
      fiber_g: product.fiberPer100 ?? null,
      salt_g: product.saltPer100 ?? null,
      saturated_fat_g: product.saturatedFatPer100 ?? null,
    },
    serving: product.servingSize ? { size: product.servingSize, unit: product.servingUnit ?? null } : null,
  };
}

/** CRUD for the authenticated user's own products in the Fitaily catalog. */
export function registerProductTools(server: McpServer, auth: McpAuth, accessToken: string): void {
  server.registerTool(
    "get_my_products",
    {
      title: "Your saved products",
      description:
        "List food products created by the user, including their per-100g/ml nutrition. Use an id from this list to edit or delete a product.",
      inputSchema: ListMyProductsInput,
      outputSchema: JsonObjectOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (input: z.infer<typeof ListMyProductsInput>) => {
      requireScope(auth, "nutrition:read");
      const response = await fitailyGet<unknown>(accessToken, "/products/my-products", {
        limit: input.limit ?? 50,
        offset: input.offset ?? 0,
      });
      const products = listOf<FoodProduct>(response, "products", "items");
      return jsonResult({ products: products.map(productSummary), count: products.length });
    },
  );

  server.registerTool(
    "create_my_product",
    {
      title: "Create a saved product",
      description:
        "WRITE: save a food product to the user's private product catalog. Nutrition values are per 100 g or ml. Confirm the name, unit and macros with the user before saving.",
      inputSchema: CreateMyProductInput,
      outputSchema: JsonObjectOutput,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (input: z.infer<typeof CreateMyProductInput>) => {
      requireScope(auth, "nutrition:write");
      const product = await fitailySend<FoodProduct>(accessToken, "POST", "/products", input);
      return jsonResult({ product: productSummary(product) });
    },
  );

  server.registerTool(
    "update_my_product",
    {
      title: "Update a saved product",
      description:
        "WRITE: edit a product created by the user. Provide its id and only changed fields; existing nutrition and optional details are preserved. Confirm the proposed changes first.",
      inputSchema: UpdateMyProductInput,
      outputSchema: JsonObjectOutput,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (input: z.infer<typeof UpdateMyProductInput>) => {
      requireScope(auth, "nutrition:write");
      const existing = await fitailyGet<FoodProduct>(accessToken, `/products/${encodeURIComponent(input.id)}`);
      const product = await fitailySend<FoodProduct>(accessToken, "PUT", `/products/${encodeURIComponent(input.id)}`, {
        name: input.name ?? existing.name,
        brand: input.brand === undefined ? existing.brand : input.brand,
        barcode: input.barcode === undefined ? existing.barcode : input.barcode,
        baseUnit: input.baseUnit ?? existing.baseUnit,
        caloriesPer100: input.caloriesPer100 ?? existing.caloriesPer100 ?? existing.calories,
        proteinPer100: input.proteinPer100 ?? existing.proteinPer100 ?? existing.protein,
        carbsPer100: input.carbsPer100 ?? existing.carbsPer100 ?? existing.carbs,
        fatPer100: input.fatPer100 ?? existing.fatPer100 ?? existing.fat,
        sugarPer100: input.sugarPer100 ?? existing.sugarPer100,
        fiberPer100: input.fiberPer100 ?? existing.fiberPer100,
        saltPer100: input.saltPer100 ?? existing.saltPer100,
        saturatedFatPer100: input.saturatedFatPer100 ?? existing.saturatedFatPer100,
        addedSugarsPer100: input.addedSugarsPer100 ?? existing.addedSugarsPer100,
        starchPer100: input.starchPer100 ?? existing.starchPer100,
        sodiumPer100: input.sodiumPer100 ?? existing.sodiumPer100,
        vitaminAPer100: input.vitaminAPer100 ?? existing.vitaminAPer100,
        vitaminEPer100: input.vitaminEPer100 ?? existing.vitaminEPer100,
        vitaminKPer100: input.vitaminKPer100 ?? existing.vitaminKPer100,
        vitaminCPer100: input.vitaminCPer100 ?? existing.vitaminCPer100,
        phosphorusPer100: input.phosphorusPer100 ?? existing.phosphorusPer100,
        ironPer100: input.ironPer100 ?? existing.ironPer100,
        magnesiumPer100: input.magnesiumPer100 ?? existing.magnesiumPer100,
        zincPer100: input.zincPer100 ?? existing.zincPer100,
        copperPer100: input.copperPer100 ?? existing.copperPer100,
        manganesePer100: input.manganesePer100 ?? existing.manganesePer100,
        seleniumPer100: input.seleniumPer100 ?? existing.seleniumPer100,
        caffeinePer100: input.caffeinePer100 ?? existing.caffeinePer100,
        fruitsVegetablesLegumesPer100: input.fruitsVegetablesLegumesPer100 ?? existing.fruitsVegetablesLegumesPer100,
        cholinePer100: input.cholinePer100 ?? existing.cholinePer100,
        servingSize: input.servingSize ?? existing.servingSize,
        servingUnit: input.servingUnit === undefined ? existing.servingUnit : input.servingUnit,
      });
      return jsonResult({ product: productSummary(product) });
    },
  );

  server.registerTool(
    "delete_my_product",
    {
      title: "Delete a saved product",
      description: "WRITE: permanently delete a product created by the user. Confirm using its name before deletion.",
      inputSchema: DeleteMyProductInput,
      outputSchema: JsonObjectOutput,
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    },
    async (input: z.infer<typeof DeleteMyProductInput>) => {
      requireScope(auth, "nutrition:write");
      await fitailySend(accessToken, "DELETE", `/products/${encodeURIComponent(input.id)}`);
      return jsonResult({ deleted: input.id });
    },
  );
}
