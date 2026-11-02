---
name: training-review
description: Use when the user asks about recent workouts, weekly activity, personal records, exercise progression or muscle balance in Fitaily. Read-only; needs training:read plus nutrition:read for the dashboard summary.
---

# Training review

## When to use

- “How did my training go this week?”, “am I consistent?”
- “What's my bench PR?”, “am I progressing on squats?”
- “Which muscles am I neglecting?”

## When not to use

- Creating or editing a workout template → `training-setup`.
- Logging a run or ride → `training-setup`.
- Weight/measurement trends → `body-progress`.

## Prerequisites

- Scopes: `training:read`, `nutrition:read` (for `get_dashboard_summary`).

## Workflow — weekly review

1. `get_dashboard_summary` for the opening numbers (today's kcal, workouts this week,
   latest weight, PRs this month).
2. `get_training_history` with `from`/`to` (last 7 or 28 days) and `limit` ≤ 20.
3. `get_activity_stats` for the same period (duration, calories, distance, per-type split).
4. `get_personal_records` only if the user asks about strength or PRs.
5. `get_muscle_activation` with `since` (default 30 days) to spot neglected muscles.
6. Summarize: sessions vs plan, total duration, standout efforts, 2–3 concrete next steps.

## Workflow — exercise progression

1. Resolve the exercise: `search_exercises` (`search`, `category`, `equipment`) →
   `get_exercise` for the id and muscle group.
2. `get_exercise_history` with `exerciseId` and `months` (1–24, default 12).
3. Describe the trend (top set, volume, frequency) and one adjustment. Do not promise a
   specific strength gain.

## Tool cheat sheet

| Tool                    | Use it for                      | Key arguments                                  |
| ----------------------- | ------------------------------- | ---------------------------------------------- |
| `get_dashboard_summary` | one-shot overview               | —                                              |
| `get_training_history`  | activities + strength workouts  | `from?`, `to?`, `limit?` (≤20)                 |
| `get_training_plan`     | planned sessions and templates  | —                                              |
| `get_activity_stats`    | period aggregates               | `from?`, `to?`                                 |
| `get_personal_records`  | current PRs + previous value    | —                                              |
| `get_exercise_history`  | completed sets for one exercise | `exerciseId`, `months?`                        |
| `get_muscle_activation` | sets per exercise since a date  | `since?`                                       |
| `search_exercises`      | find an exercise id             | `search?`, `category?`, `equipment?`, `limit?` |
| `get_exercise`          | exercise details                | `id`                                           |

## Guardrails

- This skill is read-only. If the user asks to log or change something, switch to the
  write workflow and confirm first.
- `get_training_history` has no per-second GPS and caps at 20 rows — aggregate instead of
  listing everything.
- Do not diagnose pain or prescribe rehab; suggest a professional when the user reports it.
- Report units in the user's system (kg/lb, km/mi) and say which one you used.

## Errors

| Error                              | What to tell the user                                      |
| ---------------------------------- | ---------------------------------------------------------- |
| `403 Missing scope: training:read` | Reconnect and grant training access.                       |
| Empty period                       | “No sessions logged in that window” — offer a wider range. |
| `502`                              | Fitaily is unreachable; retry shortly.                     |

## Examples

**User:** “How was my week?”
**Assistant:** `get_dashboard_summary` → `get_training_history` (last 7 days) →
`get_activity_stats` → “4 sessions, 3 h 10 min, 1 850 kcal, 32 km. Two strength days and
two runs; legs only once. Want a leg-focused template for next week?”

**User:** “Am I getting stronger on bench?”
**Assistant:** `search_exercises` → `get_exercise_history` (12 months) → “Top set went from
70×5 to 80×5 since March; frequency dropped to once a week in October.”
