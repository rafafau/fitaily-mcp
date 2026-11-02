import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { fitailyGet, fitailyGetRaw, fitailySend } from "../api/fitaily-client.js";
import { listOf, type DiscoverySection, type RecipeTagRef } from "../api/types.js";
import { today } from "../utils/dates.js";
import type { McpAuth } from "../auth/verify.js";
import { requireScope } from "../auth/verify.js";
import {
  RecipeSuggestionInput,
  ListRecipesInput,
  PublicRecipesInput,
  GetPublicRecipeInput,
  RecipeFavoriteInput,
  RateRecipeInput,
  RemainingMacrosRecipesInput,
  GetRecipeInput,
  CreateRecipeInput,
  UpdateRecipeInput,
  DeleteRecipeInput,
} from "../schemas/common.js";
import { JsonObjectOutput, jsonResult } from "../utils/result.js";

interface RawRecipe {
  id: string;
  name: string;
  localizedName?: string | null;
  description?: string | null;
  servings?: number;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  totalTimeMinutes?: number;
  isPublic?: boolean;
  slug?: string | null;
  imageUrl?: string | null;
  ingredients?: Array<{ productName?: string; amount?: number; unit?: string }>;
  steps?: Array<{ instruction?: string }>;
  tags?: Array<{ name?: string; slug?: string; label?: string } | string>;
  nutrition?: {
    caloriesPerServing?: number;
    proteinPerServing?: number;
    carbsPerServing?: number;
    fatPerServing?: number;
  } | null;
  rating?: { average?: number; count?: number } | null;
}

function tagLabels(r: RawRecipe): string[] {
  return (r.tags || [])
    .map((t) => (typeof t === "string" ? t : (t.label ?? t.name ?? t.slug ?? null)))
    .filter((t): t is string => Boolean(t));
}

/** `[{slug,label}]` — the slug is what filters accept, the label is for prose. */
function tagRefs(r: RawRecipe): Array<{ slug: string; label: string | null }> {
  return (r.tags || [])
    .map((t) => {
      if (typeof t === "string") return { slug: t, label: null };
      const slug = t.slug ?? t.name ?? null;
      if (!slug) return null;
      return { slug, label: t.label ?? t.name ?? null };
    })
    .filter((t): t is { slug: string; label: string | null } => t !== null);
}

function trimRecipe(r: RawRecipe): object {
  return {
    id: r.id,
    name: r.localizedName ?? r.name,
    servings: r.servings ?? null,
    prep_min: r.prepTimeMinutes ?? null,
    cook_min: r.cookTimeMinutes ?? null,
    total_min: r.totalTimeMinutes ?? null,
    public: r.isPublic ?? false,
    slug: r.slug ?? null,
  };
}

/** Catalog card: trimmed recipe + per-serving nutrition, rating and tags. */
function catalogCard(r: RawRecipe): object {
  return {
    ...trimRecipe(r),
    kcal: r.nutrition?.caloriesPerServing ?? null,
    protein_g: r.nutrition?.proteinPerServing ?? null,
    carbs_g: r.nutrition?.carbsPerServing ?? null,
    fat_g: r.nutrition?.fatPerServing ?? null,
    rating: r.rating?.average ?? null,
    rating_count: r.rating?.count ?? null,
    tags: tagRefs(r),
  };
}

function fullRecipe(r: RawRecipe): object {
  return {
    ...trimRecipe(r),
    description: r.description ?? null,
    image_url: r.imageUrl ?? null,
    kcal_per_serving: r.nutrition?.caloriesPerServing ?? null,
    protein_g_per_serving: r.nutrition?.proteinPerServing ?? null,
    carbs_g_per_serving: r.nutrition?.carbsPerServing ?? null,
    fat_g_per_serving: r.nutrition?.fatPerServing ?? null,
    rating: r.rating?.average ?? null,
    ingredients: (r.ingredients || []).map((i) => ({
      name: i.productName ?? null,
      amount: i.amount ?? null,
      unit: i.unit ?? null,
    })),
    steps: (r.steps || []).map((s, idx) => ({ step: idx + 1, instruction: s.instruction ?? null })),
    tags: tagLabels(r),
  };
}

/** Recipes: discovery, own library, public catalog, favorites, and full CRUD. */
export function registerRecipeTools(server: McpServer, auth: McpAuth, accessToken: string): void {
  server.registerTool(
    "get_recipe_suggestions",
    {
      description:
        "Recipe ideas ranked for the day's remaining calories (same discovery as the app). Filter by meal type and max prep time.",
      inputSchema: RecipeSuggestionInput,
      outputSchema: JsonObjectOutput,
      annotations: { readOnlyHint: true },
    },
    async (input: z.infer<typeof RecipeSuggestionInput>) => {
      requireScope(auth, "nutrition:read");
      const res = await fitailyGet<DiscoverySection[] | { sections?: DiscoverySection[] }>(
        accessToken,
        "/recipes/discovery",
        input.date ? { date: input.date } : {},
      );
      const sections = listOf<DiscoverySection>(res, "sections");
      const limit = input.limit ?? 6;
      const out: object[] = [];
      for (const s of sections) {
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
      return jsonResult({ recipes: out });
    },
  );

  server.registerTool(
    "get_my_recipes",
    {
      description: "The user's own saved recipes (id, name, times, servings).",
      inputSchema: ListRecipesInput,
      outputSchema: JsonObjectOutput,
      annotations: { readOnlyHint: true },
    },
    async (input: z.infer<typeof ListRecipesInput>) => {
      requireScope(auth, "nutrition:read");
      const res = await fitailyGet<RawRecipe[] | { recipes?: RawRecipe[] }>(accessToken, "/recipes/my", {
        search: input.search,
      });
      const recipes = listOf<RawRecipe>(res, "recipes", "data");
      return jsonResult({ recipes: recipes.slice(0, input.limit ?? 30).map(trimRecipe) });
    },
  );

  server.registerTool(
    "search_public_recipes",
    {
      description:
        "Browse the public Fitaily recipe catalog (~300 recipes) with full filters. Search matches the dish name, description AND ingredient names (so 'chicken' finds recipes using chicken). Nutrition filters are per serving. Use sort=protein_desc or calories_asc for macro-targeted picks. Tag coverage is uneven — call get_recipe_tags first to see which tags exist and how many recipes each has. Most public recipes have no ratings yet, so minRatingCount>0 and sort=rating usually return little.",
      inputSchema: PublicRecipesInput,
      outputSchema: JsonObjectOutput,
      annotations: { readOnlyHint: true },
    },
    async (input: z.infer<typeof PublicRecipesInput>) => {
      requireScope(auth, "nutrition:read");
      const res = await fitailyGetRaw<RawRecipe[] | { recipes?: RawRecipe[]; pagination?: unknown }>(
        accessToken,
        "/recipes/public",
        {
          search: input.search,
          tags: input.tags?.join(","),
          minCalories: input.minCalories,
          maxCalories: input.maxCalories,
          minProtein: input.minProtein,
          maxProtein: input.maxProtein,
          minCarbs: input.minCarbs,
          maxCarbs: input.maxCarbs,
          minFat: input.minFat,
          maxFat: input.maxFat,
          maxTotalTime: input.maxTotalTimeMin,
          minRatingCount: input.minRatingCount,
          sort: input.sort,
          page: input.page ?? 1,
          limit: input.limit ?? 20,
        },
      );
      const recipes = listOf<RawRecipe>(res, "recipes", "data");
      return jsonResult({
        recipes: recipes.map(catalogCard),
        pagination: (res as { pagination?: unknown }).pagination ?? null,
      });
    },
  );

  server.registerTool(
    "get_recipe_tags",
    {
      description:
        "Public recipe tag catalog with recipe counts. Use it before filtering by tags — many diet tags (keto, vegan, dairy-free) cover only a handful of recipes, while high-protein/vegetarian/gluten-free are broad.",
      inputSchema: z.object({}),
      outputSchema: JsonObjectOutput,
      annotations: { readOnlyHint: true },
    },
    async () => {
      requireScope(auth, "nutrition:read");
      const res = await fitailyGet<RecipeTagRef[]>(accessToken, "/recipes/tags");
      const tags = Array.isArray(res) ? res : [];
      return jsonResult({
        tags: tags.map((t) => ({
          slug: t.slug,
          label: t.label ?? t.name ?? t.slug,
          count: t.count ?? 0,
        })),
      });
    },
  );

  server.registerTool(
    "get_public_recipe",
    {
      description:
        "Full public recipe by slug (from search_public_recipes): ingredients with amounts, numbered steps, per-serving macros and tags.",
      inputSchema: GetPublicRecipeInput,
      outputSchema: JsonObjectOutput,
      annotations: { readOnlyHint: true },
    },
    async (input: z.infer<typeof GetPublicRecipeInput>) => {
      requireScope(auth, "nutrition:read");
      const r = await fitailyGet<RawRecipe>(accessToken, `/recipes/public/${encodeURIComponent(input.slug)}`);
      return jsonResult(fullRecipe(r));
    },
  );

  server.registerTool(
    "get_recipe",
    {
      description: "Full recipe by id: description, ingredient list with amounts and numbered steps.",
      inputSchema: GetRecipeInput,
      outputSchema: JsonObjectOutput,
      annotations: { readOnlyHint: true },
    },
    async (input: z.infer<typeof GetRecipeInput>) => {
      requireScope(auth, "nutrition:read");
      const r = await fitailyGet<RawRecipe>(accessToken, `/recipes/${input.id}`);
      return jsonResult(fullRecipe(r));
    },
  );

  server.registerTool(
    "find_recipes_for_remaining_macros",
    {
      description:
        "Pick recipes that fit what is LEFT of today's calorie budget. Combines the day summary (consumed vs goals) with the public catalog, then ranks by protein density. Optionally restricted to one meal type's share of the remaining budget.",
      inputSchema: RemainingMacrosRecipesInput,
      outputSchema: JsonObjectOutput,
      annotations: { readOnlyHint: true },
    },
    async (input: z.infer<typeof RemainingMacrosRecipesInput>) => {
      requireScope(auth, "nutrition:read");
      const date = input.date ?? today();
      const summary = await fitailyGet<{ remaining?: { calories?: number; protein?: number } } | null>(
        accessToken,
        "/nutrition/day-summary",
        {
          date,
        },
      ).catch(() => null);

      const remainingCalories =
        input.maxCalories ?? (typeof summary?.remaining?.calories === "number" ? summary.remaining.calories : null);
      const remainingProtein = typeof summary?.remaining?.protein === "number" ? summary.remaining.protein : null;

      // Cap at what is actually left in the day; when the user already knows the
      // per-meal budget they pass maxCalories explicitly.
      const budget = remainingCalories;

      const res = await fitailyGetRaw<RawRecipe[] | { recipes?: RawRecipe[] }>(accessToken, "/recipes/public", {
        maxCalories: budget != null && budget > 0 ? Math.max(50, budget) : undefined,
        minProtein: input.minProtein,
        maxTotalTime: input.maxTotalTimeMin,
        tags: input.tags?.join(","),
        sort: "protein_desc",
        page: 1,
        limit: Math.min(Math.max((input.limit ?? 6) * 4, 12), 40),
      });

      const candidates = listOf<RawRecipe>(res, "recipes", "data").filter((r) => {
        const kcal = r.nutrition?.caloriesPerServing;
        if (budget != null && budget > 0 && typeof kcal === "number" && kcal > budget) return false;
        return true;
      });

      const limit = input.limit ?? 6;
      return jsonResult({
        date,
        meal_type: input.mealType ?? null,
        remaining_calories: remainingCalories,
        remaining_protein_g: remainingProtein,
        calorie_budget_for_pick: budget,
        recipes: candidates.slice(0, limit).map(catalogCard),
      });
    },
  );

  server.registerTool(
    "get_favorite_recipes",
    {
      description: "Recipes the user marked as favorites.",
      inputSchema: z.object({}),
      outputSchema: JsonObjectOutput,
      annotations: { readOnlyHint: true },
    },
    async () => {
      requireScope(auth, "nutrition:read");
      const res = await fitailyGet<RawRecipe[] | { recipes?: RawRecipe[] }>(accessToken, "/recipes/favorites");
      const recipes = listOf<RawRecipe>(res, "recipes", "data");
      return jsonResult({ recipes: recipes.map(catalogCard) });
    },
  );

  server.registerTool(
    "favorite_recipe",
    {
      description:
        "WRITE: add or remove a recipe from favorites. Set favorite=false to remove (defaults to true). Confirm with the user first.",
      inputSchema: RecipeFavoriteInput,
      outputSchema: JsonObjectOutput,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async (input: z.infer<typeof RecipeFavoriteInput>) => {
      requireScope(auth, "nutrition:write");
      const favorite = input.favorite ?? true;
      if (favorite) {
        await fitailySend(accessToken, "POST", `/recipes/${input.recipeId}/favorite`);
      } else {
        await fitailySend(accessToken, "DELETE", `/recipes/${input.recipeId}/favorite`);
      }
      return jsonResult({ recipe_id: input.recipeId, favorite });
    },
  );

  server.registerTool(
    "rate_recipe",
    {
      description:
        "WRITE: rate a public recipe 1–5 stars (updates an existing rating). You cannot rate your own recipes. Confirm with the user first.",
      inputSchema: RateRecipeInput,
      outputSchema: JsonObjectOutput,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async (input: z.infer<typeof RateRecipeInput>) => {
      requireScope(auth, "nutrition:write");
      const res = await fitailySend<{ rating?: number }>(accessToken, "POST", `/recipes/${input.recipeId}/rate`, {
        rating: input.rating,
      });
      return jsonResult({ recipe_id: input.recipeId, rating: res?.rating ?? input.rating });
    },
  );

  server.registerTool(
    "create_recipe",
    {
      description:
        "WRITE: save a recipe to the user's library. Confirm the whole recipe with the user first. Ingredients need amount+unit; include per-100g macros when you know them so the app can compute nutrition.",
      inputSchema: CreateRecipeInput,
      outputSchema: JsonObjectOutput,
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (input: z.infer<typeof CreateRecipeInput>) => {
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
      return jsonResult({ recipe: trimRecipe(created) });
    },
  );

  server.registerTool(
    "update_recipe",
    {
      description:
        "WRITE: edit a recipe by id. Send only the fields that change; ingredients/steps replace the whole list. Confirm with the user first.",
      inputSchema: UpdateRecipeInput,
      outputSchema: JsonObjectOutput,
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (input: z.infer<typeof UpdateRecipeInput>) => {
      requireScope(auth, "nutrition:write");
      const { id, ...patch } = input;
      const updated = await fitailySend<RawRecipe>(accessToken, "PUT", `/recipes/${id}`, patch);
      return jsonResult({ recipe: trimRecipe(updated) });
    },
  );

  server.registerTool(
    "delete_recipe",
    {
      description: "WRITE: delete a recipe from the user's library. Confirm with the user first.",
      inputSchema: DeleteRecipeInput,
      outputSchema: JsonObjectOutput,
      annotations: { destructiveHint: true },
    },
    async (input: z.infer<typeof DeleteRecipeInput>) => {
      requireScope(auth, "nutrition:write");
      await fitailySend(accessToken, "DELETE", `/recipes/${input.id}`);
      return jsonResult({ deleted: input.id });
    },
  );
}
