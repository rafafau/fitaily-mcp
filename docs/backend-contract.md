# Backend contract notes

The MCP server is a thin, stateless adapter over the Fitaily REST API. These
notes cover the few places where the backend semantics are not obvious from
the endpoint names.

## Ranges

- `GET /nutrition` is **half-open** (`[gte, lt)`), so the tool bumps `endDate`
  by one day before calling it. This is the only range with that behaviour.
- Activity, measurement and water ranges are inclusive on both ends.
- `GET /nutrition/stats` and `GET /activity/stats` take `startDate`/`endDate`
  and are inclusive.

## Recipe nutrition filters

`minCalories`, `maxCalories`, `minProtein`, `maxCarbs`, `minFat` and friends are
computed from ingredients, not stored on the recipe row. The backend therefore
scans the catalog before paginating: filters and `page` are applied in memory,
and `pagination.total` can be smaller than the number of rows scanned. Do not
assume a Prisma `where` clause can reproduce the result.

## Diet plans

- `POST /diet-plans/generate` replaces the active plan. The tool marks it
  `destructiveHint: true` for that reason.
- Generation needs at least three recipes in the user's library or in the
  public catalog; the public catalog alone is enough.
- Public diet-plan templates are read-only and exposed through
  `get_diet_plans?tab=discover`.

## Auth

- The backend is the OAuth 2.1 authorization server (PKCE + dynamic client
  registration) and mints HS256 access tokens for the MCP resource.
- Tokens carry `userId`, `client_id`, `scope`, `aud` and `jti`, and expire after
  15 minutes. They do **not** carry `iss` yet; the MCP server verifies `iss`
  only when it is present.
- Internal callers (for example the in-app coach) mint a short-lived read-only token
  (`nutrition:read training:read progress:read`) and call `tools/call` server-side. Writes
  stay external-only.
