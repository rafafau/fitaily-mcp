import type { McpServer } from "@modelcontextprotocol/server";
import { fitailyGet, fitailySend } from "../api/fitaily-client";
import type { McpAuth } from "../auth/verify";
import { requireScope } from "../auth/verify";
import {
  RecipeSuggestionInput,
  ListRecipesInput,
  PublicRecipesInput,
  GetRecipeInput,
  CreateRecipeInput,
  UpdateRecipeInput,
  DeleteRecipeInput,
} from "../schemas/common";

interface RawRecipe {
  id: string;
  name: string;
  description?: string | null;
  servings?: number;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  totalTimeMinutes?: number;
  isPublic?: boolean;
  slug?: string | null;
  ingredients?: Array<{ productName?: string; amount?: number; unit?: string }>;
  steps?: Array<{ instruction?: string }>;
  tags?: Array<{ name?: string } | string>;
}

function trimRecipe(r: RawRecipe): object {
  return {
    id: r.id,
    name: r.name,
    servings: r.servings ?? null,
    prep_min: r.prepTimeMinutes ?? null,
    cook_min: r.cookTimeMinutes ?? null,
    total_min: r.totalTimeMinutes ?? null,
    public: r.isPublic ?? false,
    slug: r.slug ?? null,
  };
}

function fullRecipe(r: RawRecipe): object {
  return {
    ...trimRecipe(r),
    description: r.description ?? null,
    ingredients: (r.ingredients || []).map((i) => ({
      name: i.productName ?? null,
      amount: i.amount ?? null,
      unit: i.unit ?? null,
    })),
    steps: (r.steps || []).map((s, idx) => ({ step: idx + 1, instruction: s.instruction ?? null })),
    tags: (r.tags || []).map((t) => (typeof t === "string" ? t : t.name)).filter(Boolean),
  };
}

function listOf(res: any): any[] {
  if (Array.isArray(res)) return res;
  return res.recipes || res.items || res.entries || res.data || [];
}

/** Recipes: discovery, own library, public catalog, and full CRUD. */
export function registerRecipeTools(server: McpServer, auth: McpAuth, accessToken: string): void {
  server.registerTool(
    "get_recipe_suggestions",
    {
      description:
        "Recipe ideas ranked for the day's remaining calories (same discovery as the app). Filter by meal type and max prep time.",
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

  server.registerTool(
    "get_my_recipes",
    {
      description: "The user's own saved recipes (id, name, times, servings).",
      inputSchema: ListRecipesInput,
    },
    async (input) => {
      requireScope(auth, "nutrition:read");
      const res = await fitailyGet<any>(accessToken, "/recipes/my", {
        search: input.search,
      });
      const recipes = listOf(res);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ recipes: recipes.slice(0, input.limit ?? 30).map(trimRecipe) }),
          },
        ],
      };
    },
  );

  server.registerTool(
    "search_public_recipes",
    {
      description: "Browse the public Fitaily recipe catalog by name.",
      inputSchema: PublicRecipesInput,
    },
    async (input) => {
      requireScope(auth, "nutrition:read");
      const res = await fitailyGet<any>(accessToken, "/recipes/public", {
        search: input.search,
        limit: input.limit ?? 20,
      });
      const recipes = listOf(res);
      return {
        content: [{ type: "text", text: JSON.stringify({ recipes: recipes.slice(0, input.limit ?? 20).map(trimRecipe) }) }],
      };
    },
  );

  server.registerTool(
    "get_recipe",
    {
      description: "Full recipe by id: description, ingredient list with amounts and numbered steps.",
      inputSchema: GetRecipeInput,
    },
    async (input) => {
      requireScope(auth, "nutrition:read");
      const r = await fitailyGet<RawRecipe>(accessToken, `/recipes/${input.id}`);
      return { content: [{ type: "text", text: JSON.stringify(fullRecipe(r)) }] };
    },
  );

  server.registerTool(
    "create_recipe",
    {
      description:
        "WRITE: save a recipe to the user's library. Confirm the whole recipe with the user first. Ingredients need amount+unit; include per-100g macros when you know them so the app can compute nutrition.",
      inputSchema: CreateRecipeInput,
    },
    async (input) => {
      requireScope(auth, "nutrition:write");
      const created = await fitailySend<RawRecipe>(accessToken, "POST", "/recipes", {
        name: input.name,
        description: input.description,
        prepTimeMinutes: input.prepTimeMinutes,
        cookTimeMinutes: input.cookTimeMinutes,
        servings: input.servings,
        ingredients: input.ingredients,
        steps: input.steps,
        tags: input.tags,
        isPublic: input.isPublic ?? false,
        sourceLanguage: input.sourceLanguage,
      });
      return { content: [{ type: "text", text: JSON.stringify({ recipe: trimRecipe(created) }) }] };
    },
  );

  server.registerTool(
    "update_recipe",
    {
      description:
        "WRITE: edit a recipe by id. Send only the fields that change; ingredients/steps replace the whole list. Confirm with the user first.",
      inputSchema: UpdateRecipeInput,
    },
    async (input) => {
      requireScope(auth, "nutrition:write");
      const { id, ...patch } = input;
      const updated = await fitailySend<RawRecipe>(accessToken, "PUT", `/recipes/${id}`, patch);
      return { content: [{ type: "text", text: JSON.stringify({ recipe: trimRecipe(updated) }) }] };
    },
  );

  server.registerTool(
    "delete_recipe",
    {
      description: "WRITE: delete a recipe from the user's library. Confirm with the user first.",
      inputSchema: DeleteRecipeInput,
    },
    async (input) => {
      requireScope(auth, "nutrition:write");
      await fitailySend(accessToken, "DELETE", `/recipes/${input.id}`);
      return { content: [{ type: "text", text: JSON.stringify({ deleted: input.id }) }] };
    },
  );
}
