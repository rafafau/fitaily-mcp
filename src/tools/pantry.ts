import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { fitailyGet, fitailySend } from "../api/fitaily-client";
import type { McpAuth } from "../auth/verify";
import { requireScope } from "../auth/verify";
import {
  AddFridgeItemInput,
  DeleteFridgeItemInput,
  AddShoppingItemInput,
  UpdateShoppingItemInput,
} from "../schemas/common";

/** Fridge inventory + shopping list — the "what can I cook / what to buy" loop. */
export function registerPantryTools(
  server: McpServer,
  auth: McpAuth,
  accessToken: string,
): void {
  server.registerTool(
    "get_fridge",
    {
      description:
        "Everything in the user's fridge: name, quantity, category, expiry date and (when known) per-unit macros. Use it before suggesting meals from what they already own.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    async () => {
      requireScope(auth, "nutrition:read");
      const res = await fitailyGet<any>(accessToken, "/fridge");
      const items: any[] = Array.isArray(res) ? res : (res?.items ?? []);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
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
            }),
          },
        ],
      };
    },
  );

  server.registerTool(
    "add_fridge_item",
    {
      description:
        "WRITE: add an item to the fridge. Confirm with the user first. Category is a short label such as dairy, produce, meat, pantry.",
      inputSchema: AddFridgeItemInput,
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (input) => {
      requireScope(auth, "nutrition:write");
      const created = await fitailySend<any>(accessToken, "POST", "/fridge", {
        name: input.name,
        quantity: input.quantity,
        category: input.category,
        expiryDate: input.expiryDate,
        calories: input.calories,
        protein: input.protein,
        carbs: input.carbs,
        fat: input.fat,
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              id: created?.id ?? null,
              name: input.name,
              quantity: input.quantity,
            }),
          },
        ],
      };
    },
  );

  server.registerTool(
    "delete_fridge_item",
    {
      description: "WRITE: remove an item from the fridge by id. Confirm with the user first.",
      inputSchema: DeleteFridgeItemInput,
      annotations: { destructiveHint: true },
    },
    async (input) => {
      requireScope(auth, "nutrition:write");
      await fitailySend(accessToken, "DELETE", `/fridge/${input.id}`);
      return { content: [{ type: "text", text: JSON.stringify({ deleted: input.id }) }] };
    },
  );

  server.registerTool(
    "get_shopping_list",
    {
      description:
        "The current shopping list with item names, quantities, categories and completion state.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    async () => {
      requireScope(auth, "nutrition:read");
      const res = await fitailyGet<any>(accessToken, "/shopping-list");
      const list = res ?? {};
      const items: any[] = list.items ?? [];
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              list_id: list.id ?? null,
              name: list.name ?? null,
              items: items.map((i) => ({
                id: i.id ?? null,
                name: i.name ?? null,
                quantity: i.quantity ?? null,
                category: i.category ?? null,
                completed: i.isCompleted ?? false,
              })),
            }),
          },
        ],
      };
    },
  );

  server.registerTool(
    "add_shopping_item",
    {
      description:
        "WRITE: add one item to the shopping list (creates the list when missing). Confirm with the user first.",
      inputSchema: AddShoppingItemInput,
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (input) => {
      requireScope(auth, "nutrition:write");
      const created = await fitailySend<any>(accessToken, "POST", "/shopping-list/items", {
        name: input.name,
        quantity: input.quantity,
        category: input.category,
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ id: created?.id ?? null, name: input.name }),
          },
        ],
      };
    },
  );

  server.registerTool(
    "update_shopping_item",
    {
      description:
        "WRITE: tick an item off (isCompleted=true) or edit its name/quantity. Confirm with the user first.",
      inputSchema: UpdateShoppingItemInput,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async (input) => {
      requireScope(auth, "nutrition:write");
      const { id, ...patch } = input;
      const updated = await fitailySend<any>(accessToken, "PUT", `/shopping-list/items/${id}`, patch);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              id: updated?.id ?? id,
              completed: updated?.isCompleted ?? patch.isCompleted ?? null,
            }),
          },
        ],
      };
    },
  );
}
