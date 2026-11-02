---
name: body-progress
description: Use when the user asks about weight or body measurements, goal progress, trends, or a forecast of a body/activity metric in Fitaily. Needs progress:read plus nutrition:read for profile units; logging measurements or goals needs progress:write.
---

# Body progress

## When to use

- “What's my weight trend this month?”, “log 78.4 kg”.
- “Am I on track for my goal?”, “add a goal: 12 workouts this month”.
- “When will I reach 75 kg?” (forecast).

## When not to use

- Calories, meals or diet plans → the nutrition skills.
- Workout history or PRs → `training-review`.

## Prerequisites

- Scopes: `progress:read` (add `progress:write` to log), `nutrition:read` for `get_profile`.

## Workflow — status and trend

1. `get_progress_summary` (`from`/`to`, default 30 days) for the headline trend.
2. `get_measurement_history` for the raw points (weight, body fat, muscle, circumferences).
3. For aggregates use `get_measurement_stats`; for a single series use `get_metric_trend`
   (`category: measurement|nutrition|workout|hydration`, `metric` optional).
4. Answer with start → end, delta and the time window. Mention the unit system.

## Workflow — log a measurement

1. Collect at least one of `weight` (kg), `bodyFat` (%), `muscleMass` (kg), optional `date`
   (ISO) and `notes`.
2. Show the value with unit and wait for confirmation.
3. `add_measurement`.

## Workflow — goals

- Read: `get_goals` (current vs target), `get_goal_progress` (percent complete, on track).
  Nutrition goals are separate — use `get_nutrition_goals`.
- Add: `add_goal` with `type` (e.g. `weight`, `workouts`, `custom`), `name`, `targetValue`,
  optional `unit` and `targetDate` (YYYY-MM-DD).
- Update: `update_goal` with `id` and only the changed fields (`targetValue`,
  `currentValue`, `isCompleted`, `notes`).

## Workflow — forecast

1. Use `get_forecast` only when the user asks about the future.
2. Pick `metric`: `weight`, `bodyFat`, `muscleMass`, `waterMass`, `boneMass`,
   `activityDuration`, `activityCalories`, `activityDistance`, `foodCalories`,
   `foodProtein`, `foodCarbs`, `foodFat`; `predictionDays` 1–90.
3. Explain that it is a statistical projection from the logged history, not a promise, and
   mention the confidence band. The endpoint allows 10 requests/minute and caches for 6 h.

## Tool cheat sheet

| Tool                      | Use it for                        | Key arguments                                           |
| ------------------------- | --------------------------------- | ------------------------------------------------------- |
| `get_progress_summary`    | weight trend + latest measurement | `from?`, `to?`                                          |
| `get_measurement_history` | measurement points                | `from?`, `to?`, `limit?` (≤100)                         |
| `get_measurement_stats`   | min/max/avg/first/latest          | `from?`, `to?`                                          |
| `get_metric_trend`        | daily series for one metric       | `category`, `metric?`, `from?`, `to?`                   |
| `get_forecast`            | TimesFM projection                | `metric`, `predictionDays?`                             |
| `add_measurement`         | log body data                     | `weight?`, `bodyFat?`, `muscleMass?`, `date?`, `notes?` |
| `get_goals`               | goals with current values         | —                                                       |
| `get_goal_progress`       | completion and on-track state     | —                                                       |
| `add_goal`                | create a goal                     | `type`, `name`, `targetValue`, `unit?`, `targetDate?`   |
| `update_goal`             | edit/complete a goal              | `id` + changed fields                                   |
| `get_profile`             | units, height, activity level     | —                                                       |

## Guardrails

- Weight is kilograms in the API; convert only for display if the user prefers pounds and
  say which unit you used.
- `add_measurement` with no values is meaningless — require at least one measurement.
- Trends need 2+ points; with fewer, say the data is insufficient instead of inventing one.
- Forecasts are projections with confidence bands — never phrase them as certainty.
- No medical interpretation of body-fat or BMI values.

## Errors

| Error                               | What to tell the user                                  |
| ----------------------------------- | ------------------------------------------------------ |
| `403 Missing scope: progress:write` | Reconnect and allow progress write access.             |
| Forecast “insufficient history”     | Log more measurements first; the metric has a minimum. |
| `429` from the forecast backend     | Wait a minute — the forecast is rate-limited.          |
| `502`                               | Fitaily is unreachable; retry shortly.                 |

## Examples

**User:** “How's my weight?”
**Assistant:** `get_progress_summary` (30 days) → “79.6 → 78.4 kg, −1.2 kg in 30 days; last
measurement 78.4 kg on 1 Nov.”

**User:** “When will I hit 75 kg?”
**Assistant:** `get_forecast` (`metric: "weight"`, `predictionDays: 60`) → “The projection
puts 75 kg around 20 Dec, with a band of 72.9–77.1 kg — it is an estimate, not a promise.”
