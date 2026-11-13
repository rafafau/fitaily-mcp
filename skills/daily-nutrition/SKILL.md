---
name: daily-nutrition
description: Use when the user asks what they ate today, wants to log or fix a meal, log water, or check/change calorie and macro goals in Fitaily. Needs the fitaily MCP server; logging requires the nutrition:write scope.
---

# Daily nutrition

## When to use

- “What have I eaten today?”, “how many calories do I have left?”
- “Log a chicken salad for lunch”, “remove the second breakfast”, “I drank 500 ml”.
- “Set my goal to 2200 kcal and 160 g protein.”

## When not to use

- Meal ideas or a multi-day plan → `meal-planning`.
- Recipe browsing or the fridge → `recipes-and-pantry`.
- Weight/measurement questions → `body-progress`.

## Workflow — daily check-in

1. Call `get_today_nutrition` with the user's date (omit for today).
2. If the user asks for advice, call `get_profile` first (units, goals, activity level).
3. Answer with: consumed, goal, remaining, and the meal breakdown. Round kcal to 5 and
   macros to whole grams.

## Workflow — log a meal

1. Resolve the food: if the user names a product, call `search_foods` (`query`, `limit`);
   never invent a food id or its macros.
2. Build the entry: `mealType` (`breakfast|lunch|dinner|snack`), `foodName`, `calories`,
   `protein`, `carbs`, `fat`, optional `servingSize`.
3. **Show a summary and wait for an explicit “yes”.**
4. Call `add_meal`. Generate one `clientRequestId` (UUID) per user request and reuse the
   same value on retries so a retry cannot duplicate the meal.
5. Report the created entry and the updated remaining budget.

## Workflow — water and goals

- Water: `log_water` with `amountMl` (10–3000), optional ISO `date`. Undo with
  `delete_water_entry` after confirmation.
- Goals: `get_nutrition_goals`, then propose numbers and call `update_nutrition_goals`
  (`dailyCaloriesGoal` 500–15000; macros 0–1000 g) only after confirmation.

## Workflow — personal products

1. Use `get_my_products` to find a product and its id before editing or deleting it.
2. For a new product, collect its name, base unit (`g`, `ml`, etc.) and nutrition per
   100 g/ml; ask the user for missing values instead of guessing.
3. Show the product name and changed fields, then wait for explicit confirmation before
   `create_my_product`, `update_my_product` or `delete_my_product`.

## Tool cheat sheet

| Tool                     | Use it for                          | Key arguments                                                                                                    |
| ------------------------ | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `get_today_nutrition`    | totals + itemized meals for one day | `date` (YYYY-MM-DD)                                                                                              |
| `get_meal_history`       | entries over a range                | `from`, `to`, `mealType?`, `limit?` (≤50)                                                                        |
| `get_nutrition_goals`    | current calorie/macro goals         | —                                                                                                                |
| `update_nutrition_goals` | change goals                        | `dailyCaloriesGoal?`, `proteinGoal?`, `carbsGoal?`, `fatGoal?`                                                   |
| `search_foods`           | find a product before logging       | `query` (2–120), `limit?`                                                                                        |
| `add_meal`               | log a meal                          | `mealType`, `foodName`, `calories`, `protein`, `carbs`, `fat`, `servingSize?`, `date?` (ISO), `clientRequestId?` |
| `update_meal`            | fix an entry                        | `id` + any changed field                                                                                         |
| `delete_meal`            | remove an entry                     | `id`                                                                                                             |
| `get_water_history`      | water log                           | `from?`, `to?`, `limit?`                                                                                         |
| `get_my_products`        | products created by the user        | `limit?`, `offset?`                                                                                              |
| `create_my_product`      | save a personal product             | name, baseUnit, calories/protein/carbs/fat per 100, optional brand/barcode/serving                                         |
| `update_my_product`      | edit a personal product             | `id` + changed fields; existing values are preserved                                                              |
| `delete_my_product`      | permanently delete a personal product | `id`                                                                                                           |
| `log_water`              | add water                           | `amountMl`, `date?` (ISO)                                                                                        |
| `delete_water_entry`     | undo water                          | `id`                                                                                                             |

## Guardrails

- Macros are **required** for `add_meal` and must come from the user, the label/photos, or
  `search_foods` — never from imagination.
- One meal = one entry. Do not split a dish unless the user asks.
- Use the user's timezone for “today”; pass dates as `YYYY-MM-DD`.
- Deleting is destructive: quote the entry (`foodName`, kcal, meal type) before asking.
- No medical or dietetic advice; you report and log, the user decides.

## Errors

| Error                                | What to tell the user                                                                  |
| ------------------------------------ | -------------------------------------------------------------------------------------- |
| `403 Missing scope: nutrition:write` | “I can read your diary but not save to it — reconnect Fitaily and allow write access.” |
| `401`                                | “The Fitaily session expired — reconnect the integration.”                             |
| `502 Fitaily API is unreachable`     | “Fitaily is not responding right now — try again in a minute.”                         |
| `400`/validation                     | Repeat the allowed ranges instead of dumping the raw error.                            |

## Examples

**User:** “How am I doing today?”
**Assistant:** calls `get_today_nutrition`, then: “1420 / 2200 kcal, 95 g protein left. You
have breakfast (520) and lunch (650), plus one snack (250). Want a high-protein dinner idea?”

**User:** “Log 200 g Greek yogurt, 130 kcal, 20 g protein, 8 g carbs, 3 g fat.”
**Assistant:** “I'll add Greek yogurt (200 g) to breakfast: 130 kcal, P20 / C8 / F3. Save?”
→ after “yes”: `add_meal` with `mealType: "breakfast"` and a fresh `clientRequestId`.
