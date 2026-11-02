---
name: meal-planning
description: Use when the user asks what to eat next, how to fit their remaining macros, or wants a multi-day diet plan generated, activated or extended in Fitaily. Needs nutrition:read; plan changes need nutrition:write.
---

# Meal planning

## When to use

- “What should I eat for dinner?”, “something with 40 g protein left”.
- “Plan my next week”, “make it high-protein”, “extend my plan by 3 days”.
- “Switch me to the vegan plan.”

## When not to use

- Logging something already eaten → `daily-nutrition`.
- Browsing recipes for their own sake, fridge or shopping list → `recipes-and-pantry`.
- Training plans → `build-workout-plan`.

## Workflow — “what should I eat now”

1. `get_today_nutrition` for the date to learn the remaining budget.
2. For one meal: `suggest_meal` with `mealType` and `date` (ranked by history, recipes and
   products). For a macro target: `find_recipes_for_remaining_macros` with optional
   `maxCalories`, `minProtein`, `maxTotalTimeMin`, `tags`.
3. Present 2–3 options with kcal + macros per serving and why they fit. Do not log anything
   unless the user asks.
4. If the user picks one, hand off to `daily-nutrition` (confirm, then `add_meal`).

## Workflow — generate a diet plan

1. `get_profile` + `get_coach_plan` to reuse the user's real targets when available.
2. Propose: template (`balanced|highprotein|lowcarb|keto|vegan|vegetarian`), calorie and
   macro targets, `durationDays` (1–30), `mealCount` (2–6), taste/cooking preferences.
3. **Warn that generating replaces the active plan**, then wait for confirmation.
4. Call `generate_diet_plan` (pass `plannedStartDate`; optional `seed` makes the result
   reproducible).
5. Read it back with `get_diet_plan` and `maxDays: 3`; summarize day 1 and the daily totals,
   then offer the rest.

## Workflow — activate or extend

- `get_diet_plans` (`tab: "mine"`, `activeOnly: true` to check what is active) → choose id.
- `activate_diet_plan` with `id` and optional `startDate`.
- `extend_diet_plan` with `id` and `additionalDays` (1–30).

## Tool cheat sheet

| Tool                                | Use it for                       | Key arguments                                                                                                                                                                                                             |
| ----------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `suggest_meal`                      | one meal that fits today         | `mealType`, `date?`, `limit?` (≤10)                                                                                                                                                                                       |
| `find_recipes_for_remaining_macros` | recipes for the remaining budget | `date?`, `mealType?`, `maxCalories?`, `minProtein?`, `maxTotalTimeMin?`, `tags?`, `limit?`                                                                                                                                |
| `get_today_nutrition`               | remaining calories/macros        | `date?`                                                                                                                                                                                                                   |
| `get_diet_plans`                    | list plans or public templates   | `tab` (`mine                                                                                                                                                                                                              | discover`), `search?`, `activeOnly?` |
| `get_diet_plan`                     | full plan by id                  | `id`, `maxDays?` (≤60)                                                                                                                                                                                                    |
| `generate_diet_plan`                | create and activate a plan       | `template?`, `calorieTarget?`, `proteinTarget?`, `carbsTarget?`, `fatTarget?`, `durationDays?`, `mealCount?`, `tastePreference?`, `cookingTimePreference?`, `breakfastPreference?`, `tags?`, `plannedStartDate?`, `seed?` |
| `activate_diet_plan`                | make a plan active               | `id`, `startDate?`                                                                                                                                                                                                        |
| `extend_diet_plan`                  | add days                         | `id`, `additionalDays`                                                                                                                                                                                                    |

## Guardrails

- `generate_diet_plan` replaces the active plan — always say so before calling it.
- Generation needs at least three recipes in the user's library or the public catalog.
- Do not invent calorie targets: reuse profile/coach targets or ask.
- Public templates (`tab: "discover"`) are read-only; clone by generating a plan instead.
- Nutrition filters are **per serving**, not per 100 g.
- No medical advice and no promises about rate of weight change.

## Errors

| Error                                 | What to tell the user                                                  |
| ------------------------------------- | ---------------------------------------------------------------------- |
| `403 Missing scope: nutrition:write`  | Reconnect and allow write access to change plans.                      |
| “not enough recipes” from the backend | The catalog is too small — add recipes first or pick another template. |
| `502`                                 | Fitaily is unreachable; retry shortly.                                 |

## Examples

**User:** “Dinner with what I have left.”
**Assistant:** `get_today_nutrition` → 740 kcal, 55 g protein left → `suggest_meal`
(`mealType: "dinner"`) → offers salmon bowl (610 kcal, 42 g P) and chicken wrap (540 kcal,
38 g P), then asks which one to log.

**User:** “Make me a 7-day high-protein plan at 2000 kcal.”
**Assistant:** confirms template `highprotein`, 2000 kcal, protein target, 7 days → warns it
replaces the active plan → on “yes”: `generate_diet_plan`, then `get_diet_plan` and a day-1
summary.
