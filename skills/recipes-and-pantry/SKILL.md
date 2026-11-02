---
name: recipes-and-pantry
description: Use when the user wants recipe ideas from the Fitaily catalog, to save or edit their own recipe, manage favorites or ratings, or work with their fridge and shopping list. Needs nutrition:read; edits need nutrition:write.
---

# Recipes, fridge and shopping list

## When to use

- “Find a high-protein vegetarian recipe under 30 minutes.”
- “Save this recipe”, “rate it 5 stars”, “show my favorites”.
- “What's in my fridge?”, “add milk to the shopping list”, “tick off eggs”.

## When not to use

- Deciding what fits today's macros → `meal-planning`.
- Logging a meal you already ate → `daily-nutrition`.

## Workflow — find a recipe

1. If filtering by tags, call `get_recipe_tags` first (coverage is uneven; counts tell you
   which tags are useful).
2. Call `search_public_recipes` with `search`, `tags`, per-serving macro filters,
   `maxTotalTimeMin`, `sort`, `page`, `limit`.
3. Show a short list (name, kcal/protein per serving, time, tags) and the pagination info.
4. Open one with `get_public_recipe` (`slug`) for ingredients and numbered steps.

## Workflow — save or edit a recipe

1. Collect: `name`, `prepTimeMinutes`, `cookTimeMinutes`, `servings`, at least one
   ingredient (`productName`, `amount`, `unit`) and one step (`instruction`).
2. Per-100 g macros on ingredients are optional but make the recipe nutrition-complete.
3. Show the full draft and **wait for confirmation**.
4. `create_recipe`; for edits send only changed fields (`update_recipe`) — `ingredients` and
   `steps` replace the whole list.
5. Deleting (`delete_recipe`) is destructive: confirm with the recipe name.

## Workflow — fridge and shopping list

- `get_fridge` before suggesting meals from what the user owns.
- `add_fridge_item` requires `name`, `quantity`, `category` (short label: dairy, produce,
  meat, pantry) and optional expiry/macros; `delete_fridge_item` by `id`.
- `get_shopping_list` → `add_shopping_item` (name required, quantity/category optional) →
  `update_shopping_item` to tick off (`isCompleted: true`) or rename.

## Tool cheat sheet

| Tool                    | Use it for                 | Key arguments                                                                                                                                  |
| ----------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `search_public_recipes` | browse the public catalog  | `search?`, `tags?` (≤6), `min/maxCalories?`, `min/maxProtein?`, `min/maxCarbs?`, `min/maxFat?`, `maxTotalTimeMin?`, `sort?`, `page?`, `limit?` |
| `get_recipe_tags`       | tag list with counts       | —                                                                                                                                              |
| `get_public_recipe`     | full public recipe         | `slug`                                                                                                                                         |
| `get_my_recipes`        | the user's recipes         | `search?`, `limit?`                                                                                                                            |
| `get_recipe`            | full private recipe        | `id`                                                                                                                                           |
| `get_favorite_recipes`  | favorites                  | —                                                                                                                                              |
| `favorite_recipe`       | add/remove favorite        | `recipeId`, `favorite?` (default true)                                                                                                         |
| `rate_recipe`           | 1–5 stars                  | `recipeId`, `rating`                                                                                                                           |
| `create_recipe`         | save a recipe              | `name`, `prepTimeMinutes`, `cookTimeMinutes`, `servings`, `ingredients[]`, `steps[]`, `tags?`, `isPublic?`                                     |
| `update_recipe`         | edit a recipe              | `id` + changed fields (lists replace)                                                                                                          |
| `delete_recipe`         | remove a recipe            | `id`                                                                                                                                           |
| `get_fridge`            | fridge contents            | —                                                                                                                                              |
| `add_fridge_item`       | add to fridge              | `name`, `quantity`, `category`, `expiryDate?`, macros?                                                                                         |
| `delete_fridge_item`    | remove from fridge         | `id`                                                                                                                                           |
| `get_shopping_list`     | list with completion state | —                                                                                                                                              |
| `add_shopping_item`     | add one item               | `name`, `quantity?`, `category?`                                                                                                               |
| `update_shopping_item`  | tick off / edit            | `id`, `isCompleted?`, `name?`, `quantity?`                                                                                                     |

## Guardrails

- Never invent a `slug`, `recipeId` or item `id`; resolve it with the matching list/search.
- Nutrition filters are **per serving**.
- `minRatingCount` and `sort: "rating"` return little: most public recipes have no ratings.
- You cannot rate the user's own recipes.
- Recipe writes are long: repeat the macro/time summary and get a clear “yes”.
- Only set `isPublic: true` if the user explicitly wants to publish.

## Errors

| Error                                | What to tell the user                                      |
| ------------------------------------ | ---------------------------------------------------------- |
| `403 Missing scope: nutrition:write` | Reconnect and allow write access.                          |
| Empty list                           | Widen filters or drop tags — say which filter you relaxed. |
| `404` on a slug                      | The recipe was removed; search again.                      |
| `502`                                | Fitaily is unreachable; retry shortly.                     |

## Examples

**User:** “High-protein vegan dinners under 30 minutes.”
**Assistant:** `get_recipe_tags` → `search_public_recipes` with `tags: ["vegan"]`,
`minProtein: 25`, `maxTotalTimeMin: 30`, `sort: "protein_desc"` → three cards with
kcal/protein/time → offers to open one or log it.

**User:** “Add oat milk to the shopping list.”
**Assistant:** `get_shopping_list` (check for a duplicate) → `add_shopping_item`
(`name: "Oat milk"`) → confirms the list now has 7 items.
