---
name: _template
description: Use when … Replace this with the trigger condition, the user goal and the Fitaily MCP scopes the skill needs. Keep it under 1024 characters.
---

# <Skill title>

## When to use

- …

## When not to use

- …

## Prerequisites

- Fitaily MCP server connected as `fitaily`.
- Scopes: `…:read` (add `…:write` for mutations).

## Workflow

1. Read the minimum context first (`…`).
2. Show the user what you are about to do.
3. For writes: **wait for an explicit “yes”**.
4. Call the tool, then read the result back.

## Tool cheat sheet

| Tool        | Use it for | Key arguments     |
| ----------- | ---------- | ----------------- |
| `tool_name` | …          | `field`, `field?` |

## Guardrails

- Never invent ids — resolve them with the matching search tool.
- Units and dates: …
- No medical advice.

## Errors

| Error                  | What to tell the user                           |
| ---------------------- | ----------------------------------------------- |
| `403 Missing scope: …` | Reconnect Fitaily and grant the scope.          |
| `401`                  | The session expired — reconnect.                |
| `502`                  | Fitaily is unreachable — try again in a moment. |

## Examples

**User:** …

**Assistant:** …

## Reference

Full arguments: [docs/tools.md](https://github.com/rafafau/fitaily-mcp/blob/main/docs/tools.md)
