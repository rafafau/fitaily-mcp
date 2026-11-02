# Tool reference

All 66 tools exposed by Fitaily MCP, grouped the same way as the source in
`src/tools/`. The table is the single source of truth for tool names: the
`docs/tools.md` test fails when a tool is added or renamed without updating
this file.

**Kind** — `read` never mutates data; `write` creates or updates; `destructive`
deletes or replaces existing data. Every write tool asks the model to confirm
with the user first; the server cannot enforce that, so the client and the
skill instructions carry the responsibility.

**Scopes** — `nutrition:*` covers meals, water, foods, recipes, diet plans,
pantry and profile; `training:*` covers activities, workout templates, the
exercise catalog and strength stats; `progress:*` covers measurements, goals,
aggregates and forecasts.

## Conventions

- Dates are `YYYY-MM-DD` in the user's timezone. Ranges are inclusive except
  `GET /nutrition`, which is half-open (the tool compensates).
- `log_activity` takes minutes and converts to seconds; water is in
  milliliters; weight is in kilograms; macros are grams.
- List tools accept `limit` and usually default to a small page; use
  pagination fields instead of asking for hundreds of rows.
- Write tools return the created/updated id so a follow-up call does not have
  to guess.
- Every result is a JSON object returned twice: as `content[0].text` (the wire
  format for text-only clients) and as `structuredContent` for clients that
  parse tool output. All tools share one `outputSchema` (`type: object`)
  because each returns its own trimmed projection.
- Errors surface as tool error text; upstream failures are normalized to a short message
  (unreachable, unauthorized, backend error) and the backend response body is never
  forwarded to the model.

## Nutrition

| Tool | What it does | Scope | Kind |
|---|---|---|---|
| `get_today_nutrition` | Daily nutrition: consumed calories/macros, goals, remaining budget AND the itemized meal list. Defaults to today. | `nutrition:read` | read |
| `get_meal_history` | Meal entries over a date range, optionally filtered by meal type. | `nutrition:read` | read |
| `get_nutrition_goals` | Current daily calorie and macro goals. | `nutrition:read` | read |
| `suggest_meal` | What to eat next for a given meal type: the backend splits the remaining daily budget across meals and ranks candidates from the user's history, recipes and products. Returns projected macros and a match score; falls back to recipes when nothing fits. | `nutrition:read` | read |
| `update_nutrition_goals` | WRITE: change daily calorie/macro goals. Confirm the new numbers with the user first. | `nutrition:write` | write |
| `add_meal` | WRITE: log a meal. Ask the user to confirm first (dish, meal type, macros). Macros are required — look them up with search_foods, never invent them. clientRequestId: generate once per user request (uuid) and reuse it if you retry, so a retry never duplicates the meal. | `nutrition:write` | write |
| `update_meal` | WRITE: edit a logged meal by id (from get_today_nutrition/get_meal_history). Confirm with the user first. | `nutrition:write` | write |
| `delete_meal` | WRITE: delete a logged meal by id. Confirm with the user first. | `nutrition:write` | destructive |

## Foods

| Tool | What it does | Scope | Kind |
|---|---|---|---|
| `search_foods` | Search the food catalog by name (per-100g macros, servings). Call this before add_meal when the user names a product instead of giving macros. | `nutrition:read` | read |
| `get_food_by_barcode` | Look up a product by barcode (per-100g macros). | `nutrition:read` | read |

## Water

| Tool | What it does | Scope | Kind |
|---|---|---|---|
| `get_water_history` | Water intake entries over a date range. | `nutrition:read` | read |
| `log_water` | WRITE: log water intake in milliliters. Confirm with the user first. | `nutrition:write` | write |
| `delete_water_entry` | WRITE: delete a water entry by id. Confirm with the user first. | `nutrition:write` | destructive |

## Recipes

| Tool | What it does | Scope | Kind |
|---|---|---|---|
| `get_recipe_suggestions` | Recipe ideas ranked for the day's remaining calories (same discovery as the app). Filter by meal type and max prep time. | `nutrition:read` | read |
| `get_my_recipes` | The user's own saved recipes (id, name, times, servings). | `nutrition:read` | read |
| `search_public_recipes` | Browse the public Fitaily recipe catalog (~300 recipes) with full filters. Search matches the dish name, description AND ingredient names (so 'chicken' finds recipes using chicken). Nutrition filters are per serving. Use sort=protein_desc or calories_asc for macro-targeted picks. Tag coverage is uneven — call get_recipe_tags first to see which tags exist and how many recipes each has. Most public recipes have no ratings yet, so minRatingCount>0 and sort=rating usually return little. | `nutrition:read` | read |
| `get_recipe_tags` | Public recipe tag catalog with recipe counts. Use it before filtering by tags — many diet tags (keto, vegan, dairy-free) cover only a handful of recipes, while high-protein/vegetarian/gluten-free are broad. | `nutrition:read` | read |
| `get_public_recipe` | Full public recipe by slug (from search_public_recipes): ingredients with amounts, numbered steps, per-serving macros and tags. | `nutrition:read` | read |
| `get_recipe` | Full recipe by id: description, ingredient list with amounts and numbered steps. | `nutrition:read` | read |
| `find_recipes_for_remaining_macros` | Pick recipes that fit what is LEFT of today's calorie budget. Combines the day summary (consumed vs goals) with the public catalog, then ranks by protein density. Optionally restricted to one meal type's share of the remaining budget. | `nutrition:read` | read |
| `get_favorite_recipes` | Recipes the user marked as favorites. | `nutrition:read` | read |
| `favorite_recipe` | WRITE: add or remove a recipe from favorites. Set favorite=false to remove (defaults to true). Confirm with the user first. | `nutrition:write` | write |
| `rate_recipe` | WRITE: rate a public recipe 1–5 stars (updates an existing rating). You cannot rate your own recipes. Confirm with the user first. | `nutrition:write` | write |
| `create_recipe` | WRITE: save a recipe to the user's library. Confirm the whole recipe with the user first. Ingredients need amount+unit; include per-100g macros when you know them so the app can compute nutrition. | `nutrition:write` | write |
| `update_recipe` | WRITE: edit a recipe by id. Send only the fields that change; ingredients/steps replace the whole list. Confirm with the user first. | `nutrition:write` | write |
| `delete_recipe` | WRITE: delete a recipe from the user's library. Confirm with the user first. | `nutrition:write` | destructive |

## Diet plans

| Tool | What it does | Scope | Kind |
|---|---|---|---|
| `get_diet_plans` | The user's diet plans (or public templates with tab=discover). Returns headline targets only — call get_diet_plan for the day-by-day meals. | `nutrition:read` | read |
| `get_diet_plan` | Full diet plan by id: day-by-day meals with per-meal and per-day macro totals. Use maxDays to keep long plans readable. | `nutrition:read` | read |
| `generate_diet_plan` | WRITE: generate a new diet plan and make it the active one (replaces the previous plan). Needs at least 3 recipes in the library or the public catalog — the catalog alone is enough. Templates: balanced, highprotein, lowcarb, keto, vegan, vegetarian. Confirm targets with the user first. | `nutrition:write` | destructive |
| `activate_diet_plan` | WRITE: make an existing diet plan the active one, optionally from a given start date. Confirm with the user first. | `nutrition:write` | write |
| `extend_diet_plan` | WRITE: extend a diet plan by N more days (reuses the plan's template and targets). Confirm with the user first. | `nutrition:write` | write |

## Training

| Tool | What it does | Scope | Kind |
|---|---|---|---|
| `get_training_history` | Recent activities and strength workouts (type, date, distance, duration). No per-second GPS. | `training:read` | read |
| `get_training_plan` | Planned training sessions (multi-sport plans and strength templates). | `training:read` | read |
| `log_activity` | WRITE: log a simple cardio/manual activity (run, ride, walk). Confirm with the user first. Strength sessions cannot be created here — one active session per user plus set structure don't fit chat. | `training:write` | write |
| `get_workout_plans` | Saved workout templates (name, description, origin, exercises). A template generated by a training plan has origin PLAN_TEMPLATE and is not shown in the app's workout library; pass origin=standalone to list only the user's own templates. | `training:read` | read |
| `get_workout_plan` | One workout template by id, with exercises and their sets/reps. | `training:read` | read |
| `create_workout_plan` | WRITE: create a workout template. Confirm the whole template with the user first. exerciseId values must come from search_exercises — never invent them. reps is a free string (e.g. "8-12"). | `training:write` | write |
| `update_workout_plan` | WRITE: update a strength plan. Send only changed fields; `exercises` replaces the whole list. Confirm with the user first. | `training:write` | write |
| `delete_workout_plan` | WRITE: delete a strength plan template. Confirm with the user first. | `training:write` | destructive |

## Exercise catalog

| Tool | What it does | Scope | Kind |
|---|---|---|---|
| `search_exercises` | Search the Fitaily exercise catalog (name, category, equipment). Returns exerciseId values used when building a workout plan. Call this before create_workout_plan. | `training:read` | read |
| `get_exercise` | Single exercise by id (category, muscle group, equipment, type). | `training:read` | read |

## Strength stats

| Tool | What it does | Scope | Kind |
|---|---|---|---|
| `get_personal_records` | All current personal records (1RM, max weight, max reps, max volume, best time) with the previous value so you can show the delta. | `training:read` | read |
| `get_exercise_history` | Completed sets of one exercise over the last N months (default 12, max 24), newest first — use it to judge progression before recommending loads. | `training:read` | read |
| `get_muscle_activation` | Completed sets per exercise since a date (default 30 days), for balance analysis: which muscles were trained and which were neglected. | `training:read` | read |

## Progress

| Tool | What it does | Scope | Kind |
|---|---|---|---|
| `get_progress_summary` | Weight trend and latest measurement. Defaults to the last 30 days. | `progress:read` | read |
| `get_measurement_history` | Body measurements (weight, body fat, muscle, circumferences) over a range. | `progress:read` | read |
| `get_goals` | User goals with current vs target values. | `progress:read` | read |
| `add_measurement` | WRITE: log a body measurement (weight and/or composition). Confirm with the user first. | `progress:write` | write |
| `add_goal` | WRITE: create a goal (weight, workouts, custom). Confirm with the user first. | `progress:write` | write |
| `update_goal` | WRITE: update a goal (values, completion). Confirm with the user first. | `progress:write` | write |

## Stats

| Tool | What it does | Scope | Kind |
|---|---|---|---|
| `get_nutrition_stats` | Nutrition aggregates over a period: totals, daily averages, entries per meal type and how many days hit the calorie goal. Defaults to the last 30 days. | `nutrition:read` | read |
| `get_activity_stats` | Activity aggregates over a period: total duration, calories burned, distance and a per-type breakdown. Defaults to the last 30 days. | `training:read` | read |
| `get_measurement_stats` | Body measurement aggregates over a period: min/max/average/first/latest for weight, body fat, muscle mass and BMI. Defaults to the last 30 days. | `progress:read` | read |
| `get_goal_progress` | Progress of every active goal (weight, workouts, custom): current vs target, percent complete and whether it is on track. Nutrition goals are excluded — use get_nutrition_goals. | `progress:read` | read |
| `query_nutrition_history` | Meals aggregated by product over a period: how many times it was eaten and the average calories/macros per occurrence. Answers 'what do I eat most often' without listing every entry. | `nutrition:read` | read |
| `get_metric_trend` | Daily series for one metric: measurements (weight/bodyFat/bmi/muscleMass), nutrition (calories/protein/carbs/fat), workouts (duration/burnedCalories) or hydration (amount). Returns points, delta and start/end values — ideal for a trend summary or a chart. | `progress:read` | read |
| `get_forecast` | TimesFM time-series forecast for one metric (weight, body fat, muscle, activity, food macros). Returns daily points with confidence bands. Needs enough history (metric-specific minimum) and is limited to 10 requests/minute; results are cached for 6h. Use it only when the user asks about the future (e.g. 'when will I reach my target weight'), not for current values. | `progress:read` | read |

## Profile

| Tool | What it does | Scope | Kind |
|---|---|---|---|
| `get_profile` | The user's profile: latest weight, height, age, sex, units, language, activity level, weight direction, target weight and current daily goals. Read this before giving calorie or macro advice. | `nutrition:read` | read |
| `get_coach_plan` | The adaptive coach plan: goal, phase, target weekly rate, current calorie target, macro strategy, protein per kg and the effective daily goals. Returns active=false when the user never enabled the coach. | `nutrition:read` | read |
| `get_dashboard_summary` | One-shot overview for an opening answer: today's calories, workouts completed this week, latest weight and personal records set this month. | `nutrition:read` | read |

## Fridge & shopping list

| Tool | What it does | Scope | Kind |
|---|---|---|---|
| `get_fridge` | Everything in the user's fridge: name, quantity, category, expiry date and (when known) per-unit macros. Use it before suggesting meals from what they already own. | `nutrition:read` | read |
| `add_fridge_item` | WRITE: add an item to the fridge. Confirm with the user first. Category is a short label such as dairy, produce, meat, pantry. | `nutrition:write` | write |
| `delete_fridge_item` | WRITE: remove an item from the fridge by id. Confirm with the user first. | `nutrition:write` | destructive |
| `get_shopping_list` | The current shopping list with item names, quantities, categories and completion state. | `nutrition:read` | read |
| `add_shopping_item` | WRITE: add one item to the shopping list (creates the list when missing). Confirm with the user first. | `nutrition:write` | write |
| `update_shopping_item` | WRITE: tick an item off (isCompleted=true) or edit its name/quantity. Confirm with the user first. | `nutrition:write` | write |
