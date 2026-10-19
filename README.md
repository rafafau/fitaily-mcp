# Fitaily MCP server

Remote MCP over Streamable HTTP. No business logic, no DB access —
every tool calls the existing Fitaily REST API with the user's OAuth token.
Read tools are free on every account; writes require the `*:write` scope and
must be confirmed by the user in the chat.

## Env

| Var | Default | Notes |
|---|---|---|
| `PORT` | `3091` | container port |
| `FITAILY_API_URL` | `http://backend:3001/api` | existing backend |
| `MCP_RESOURCE_URL` | `https://mcp.fitaily.com/mcp` | must match OAuth `aud` |
| `OAUTH_ISSUER` | `https://fitaily.com` | backend OAuth AS |
| `JWT_SECRET` | — | same value as backend (verifies OAuth access JWTs) |

## Run

```bash
pnpm install
pnpm dev      # http://localhost:3091/mcp + /health
pnpm test
```

## Tools (64)

**Nutrition** — `get_today_nutrition`, `get_meal_history`, `get_nutrition_goals`,
`update_nutrition_goals`, `suggest_meal`, `add_meal`, `update_meal`, `delete_meal`

**Foods** — `search_foods`, `get_food_by_barcode`

**Water** — `get_water_history`, `log_water`, `delete_water_entry`

**Recipes** — `get_recipe_suggestions`, `get_my_recipes`, `search_public_recipes`
(filters: search/tags/calories/protein/carbs/fat/time/sort/page),
`get_recipe_tags`, `get_public_recipe`, `get_recipe`,
`find_recipes_for_remaining_macros`, `get_favorite_recipes`, `favorite_recipe`,
`rate_recipe`, `create_recipe`, `update_recipe`, `delete_recipe`

**Diet plans** — `get_diet_plans`, `get_diet_plan`, `generate_diet_plan`,
`activate_diet_plan`, `extend_diet_plan`

**Training** — `get_training_history`, `get_training_plan`, `log_activity`,
`get_workout_plans`, `get_workout_plan`, `create_workout_plan`,
`update_workout_plan`, `delete_workout_plan`

**Exercise catalog** — `search_exercises`, `get_exercise`

**Strength stats** — `get_personal_records`, `get_exercise_history`,
`get_muscle_activation`

**Progress** — `get_progress_summary`, `get_measurement_history`, `get_goals`,
`get_goal_progress`, `get_nutrition_stats`, `get_activity_stats`,
`get_measurement_stats`, `get_forecast` (TimesFM), `add_measurement`, `add_goal`,
`update_goal`

**Profile** — `get_profile`, `get_coach_plan`, `get_dashboard_summary`

**Fridge / shopping list** — `get_fridge`, `add_fridge_item`,
`delete_fridge_item`, `get_shopping_list`, `add_shopping_item`,
`update_shopping_item`

Every read tool carries `readOnlyHint: true`; destructive writes carry
`destructiveHint: true`. Input schemas live in `src/schemas/common.ts`.

Backend contract notes:

- `GET /nutrition` uses a half-open range (`[gte, lt)`) — the tool bumps
  `endDate` by one day; activity/measurement ranges are inclusive.
- Recipe nutrition filters are computed from ingredients, so the backend scans
  the catalog before paginating (do not assume a Prisma `where`).

## Infra

Separate container on the Pi (`fitaily-shared` network), Cloudflare Tunnel
hostname `mcp.fitaily.com` → `fitaily-mcp:3091`. Tunnel path routing for
`fitaily.com` is untouched.
