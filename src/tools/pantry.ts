import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { fitailyGet, fitailySend } from "../api/fitaily-client.js";
import { listOf, type CreatedEntity, type FridgeItem, type ShoppingItem, type ShoppingList } from "../api/types.js";
import type { McpAuth } from "../auth/verify.js";
import { requireScope } from "../auth/verify.js";
import {
  AddFridgeItemInput,
  DeleteFridgeItemInput,
  AddShoppingItemInput,
  UpdateShoppingItemInput,
} from "../schemas/common.js";
import { JsonObjectOutput, jsonResult } from "../utils/result.js";

/** Fridge inventory + shopping list — the "what can I cook / what to buy" loop. */
export function registerPantryTools(server: McpServer, auth: McpAuth, accessToken: string): void {
  server.registerTool(
    "get_fridge",
    {
      title: "Fridge contents",
      description:
        "Everything in the user's fridge: name, quantity, category, expiry date and (when known) per-unit macros. Use it before suggesting meals from what they already own.",
      inputSchema: z.object({}),
      outputSchema: JsonObjectOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async () => {
      requireScope(auth, "nutrition:read");
      const res = await fitailyGet<unknown>(accessToken, "/fridge");
      const items = listOf<FridgeItem>(res, "items");
      return jsonResult({
        count: items.length,
        items: items.map((i) => ({
          id: i.id ?? null,
          name: i.name ?? null,
          quantity: i.quantity ?? null,
          category: i.category ?? null,
          expires: i.expiryDate ?? null,
          kcal: i.calories ?? null,
          protein_g: i.protein ?? null,
          carbs_g: i.carbs ?? null,
          fat_g: i.fat ?? null,
        })),
      });
    },
  );

  server.registerTool(
    "add_fridge_item",
    {
      title: "Add a fridge item",
      description:
        "WRITE: add an item to the fridge. Confirm with the user first. Category is a short label such as dairy, produce, meat, pantry.",
      inputSchema: AddFridgeItemInput,
      outputSchema: JsonObjectOutput,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (input: z.infer<typeof AddFridgeItemInput>) => {
      requireScope(auth, "nutrition:write");
      const created = await fitailySend<CreatedEntity>(accessToken, "POST", "/fridge", {
        name: input.name,
        quantity: input.quantity,
        category: input.category,
        expiryDate: input.expiryDate,
        calories: input.calories,
        protein: input.protein,
        carbs: input.carbs,
        fat: input.fat,
      });
      return jsonResult({
        id: created.id ?? null,
        name: input.name,
        quantity: input.quantity,
      });
    },
  );

  server.registerTool(
    "delete_fridge_item",
    {
      title: "Remove a fridge item",
      description: "WRITE: remove an item from the fridge by id. Confirm with the user first.",
      inputSchema: DeleteFridgeItemInput,
      outputSchema: JsonObjectOutput,
      annotations: { destructiveHint: true, readOnlyHint: false, openWorldHint: false },
    },
    async (input) => {
      requireScope(auth, "nutrition:write");
      await fitailySend(accessToken, "DELETE", `/fridge/${input.id}`);
      return jsonResult({ deleted: input.id });
    },
  );

  server.registerTool(
    "get_shopping_list",
    {
      title: "Shopping list",
      description: "The current shopping list with item names, quantities, categories and completion state.",
      inputSchema: z.object({}),
      outputSchema: JsonObjectOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async () => {
      requireScope(auth, "nutrition:read");
      const res = await fitailyGet<unknown>(accessToken, "/shopping-list");
      const items = listOf<ShoppingItem>(res, "items");
      return jsonResult({
        list_id: (res as ShoppingList)?.id ?? null,
        name: (res as ShoppingList)?.name ?? null,
        items: items.map((i) => ({
          id: i.id ?? null,
          name: i.name ?? null,
          quantity: i.quantity ?? null,
          category: i.category ?? null,
          completed: i.isCompleted ?? false,
        })),
      });
    },
  );

  server.registerTool(
    "add_shopping_item",
    {
      title: "Add a shopping item",
      description:
        "WRITE: add one item to the shopping list (creates the list when missing). Confirm with the user first.",
      inputSchema: AddShoppingItemInput,
      outputSchema: JsonObjectOutput,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (input: z.infer<typeof AddShoppingItemInput>) => {
      requireScope(auth, "nutrition:write");
      const created = await fitailySend<CreatedEntity>(accessToken, "POST", "/shopping-list/items", {
        name: input.name,
        quantity: input.quantity,
        category: input.category,
      });
      return jsonResult({ id: created.id ?? null, name: input.name });
    },
  );

  server.registerTool(
    "update_shopping_item",
    {
      title: "Update a shopping item",
      description: "WRITE: tick an item off (isCompleted=true) or edit its name/quantity. Confirm with the user first.",
      inputSchema: UpdateShoppingItemInput,
      outputSchema: JsonObjectOutput,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (input: z.infer<typeof UpdateShoppingItemInput>) => {
      requireScope(auth, "nutrition:write");
      const { id, ...patch } = input;
      const updated = await fitailySend<CreatedEntity>(accessToken, "PUT", `/shopping-list/items/${id}`, patch);
      return jsonResult({
        id: updated.id ?? id,
        completed: patch.isCompleted ?? null,
      });
    },
  );
}
