# Skills

Agent skills that teach an MCP client **how to use the Fitaily tools** instead of
guessing among 70 endpoints. Each skill is a self-contained `SKILL.md` with a workflow,
a tool cheat sheet, guardrails and error handling.

They are plain [Agent Skills](https://code.claude.com/docs/en/skills) — no build step, no
runtime dependency. The server does not need them; they improve tool selection and make
write confirmations explicit.

## Skills

| Skill                                             | Use it for                                                      | Scopes                       |
| ------------------------------------------------- | --------------------------------------------------------------- | ---------------------------- |
| [daily-nutrition](daily-nutrition/SKILL.md)       | “what did I eat today”, log/fix meals and water, change goals   | nutrition:read/write         |
| [meal-planning](meal-planning/SKILL.md)           | what to eat next, remaining macros, generate/extend a diet plan | nutrition:read/write         |
| [recipes-and-pantry](recipes-and-pantry/SKILL.md) | browse and save recipes, fridge, shopping list                  | nutrition:read/write         |
| [training-review](training-review/SKILL.md)       | weekly review, activity stats, personal records, muscle balance | training:read, nutrition:read |
| [training-setup](training-setup/SKILL.md)         | log cardio, create/update/delete a strength template            | training:read/write          |
| [body-progress](body-progress/SKILL.md)           | weight and measurements, goals, trends, forecast                | progress:read/write, nutrition:read |

## Install

Claude Code:

```bash
cp -r skills/daily-nutrition ~/.claude/skills/
```

OpenCode (global or per project):

```bash
cp -r skills/daily-nutrition ~/.config/opencode/skills/
# or
cp -r skills/daily-nutrition .opencode/skills/
```

Copy the skills you need; they do not import each other. If your client supports a
marketplace command, publish the repository and point it at `skills/`.

## Authoring rules

- `name` must match the directory and be lowercase-hyphenated.
- `description` must say **when** to use the skill (start with “Use when…”) and name the
  scopes it needs.
- Every write step has an explicit “show a summary → wait for confirmation → call” step.
- Reference tools with their exact names; `pnpm validate:skills` fails on unknown names.
- Link to [docs/tools.md](https://github.com/rafafau/fitaily-mcp/blob/main/docs/tools.md)
  for full arguments instead of copying the whole schema.
- Never include tokens, user data, internal hostnames or backend response bodies.

Run `pnpm validate:skills` after edits; CI runs it too. Start new skills from
[`_template/SKILL.md`](_template/SKILL.md).
