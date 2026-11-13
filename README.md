# Fitaily MCP

[![CI](https://github.com/rafafau/fitaily-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/rafafau/fitaily-mcp/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D24-brightgreen.svg)](package.json)

Remote [Model Context Protocol](https://modelcontextprotocol.io) server that exposes the
Fitaily nutrition, training and progress API as **70 tools** over Streamable HTTP.

## Connect in 30 seconds

### Claude

In [Claude](https://claude.ai/customize/connectors), open **Customize → Connectors → + Add → Add custom connector**. Name it `Fitaily`, enter `https://mcp.fitaily.com/mcp`, then sign in to Fitaily and choose read-only or read-and-write access. A connector added to your Claude account is also available in Claude mobile and desktop.

### ChatGPT

Custom MCP servers are currently available on ChatGPT Business and Enterprise/Edu workspaces, and setup is done on the web. Open **Plugins → + → Add custom MCP server**, enter `https://mcp.fitaily.com/mcp`, configure OAuth, review the warning, and create the plugin. Workspace permissions may limit who can add it. See [OpenAI's setup guide](https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt).

### Try it

- “Review my meals and nutrition today.”
- “Find a Fitaily food entry for this meal and prepare it for my log.”
- “Summarize my training and body progress this week.”

Fitaily offers read-only or read-and-write access during sign-in. For a write, ask the assistant to show the proposed change and wait for your explicit confirmation before saving. See the [Fitaily MCP guide](https://fitaily.com/mcp), [privacy policy](https://fitaily.com/privacy-policy), and [terms of service](https://fitaily.com/terms-of-service). Support: [info@fitaily.com](mailto:info@fitaily.com).

---

> **Companion server.** Fitaily MCP has no database and no business logic of its own: every
> tool calls the Fitaily REST API with the user's OAuth token. You need a running Fitaily
> backend, the same `JWT_SECRET`, and an OAuth client (ChatGPT, Claude, Cursor, OpenCode…).
> It is not a standalone fitness tracker.

---

## What it is

- **Stateless.** One `McpServer` + transport per request; no sessions, no cache, no storage.
- **OAuth 2.1 (PKCE).** The Fitaily backend is the authorization server; this process only
  verifies HS256 access tokens (audience, scopes, expiry).
- **Scoped access.** Every tool checks a `*:read` or `*:write` scope before calling the
  backend; writes are annotated as `write`/`destructive` so clients can ask first.
- **Thin.** Backend failures are classified as unauthorized (`401`/`403`) or
  unreachable/error (`502`) and returned as short tool errors; response bodies are never
  forwarded to the model.
- **Structured results.** Every tool declares an `outputSchema` and returns the same JSON in
  `structuredContent` and in `content[0].text`, so typed clients can parse results while
  text-only clients keep working.

## What it is not

- Not a medical device and not medical advice. It reports what the user logged.
- Not a data store: nothing is persisted, cached or written to disk.
- Not a replacement for the Fitaily REST API — the API remains the source of truth.

## Requirements

| Requirement     | Notes                                                         |
| --------------- | ------------------------------------------------------------- |
| Node.js 24+     | matches the package engine and Docker image                   |
| pnpm 10+        | `corepack enable` is enough                                   |
| Fitaily backend | must expose `/api/oauth/*` and accept the shared `JWT_SECRET` |
| OAuth client    | any MCP client that supports remote HTTP + OAuth discovery    |

## Self-hosting and local development

```bash
git clone https://github.com/rafafau/fitaily-mcp.git
cd fitaily-mcp
corepack enable
pnpm install
cp .env.example .env      # set JWT_SECRET, FITAILY_API_URL and MCP_RESOURCE_URL
pnpm dev
```

```bash
curl -s http://localhost:3091/health
# {"success":true,"service":"fitaily","version":"0.3.0","timestamp":"…"}
```

To exercise `/mcp` locally you need a token minted for this resource. Load the same
`.env` in your shell and create a short-lived development token:

```bash
set -a; . ./.env; set +a
TOKEN=$(node -e "console.log(require('jsonwebtoken').sign(
  { userId: 'dev', scope: 'nutrition:read training:read progress:read', aud: process.env.MCP_RESOURCE_URL },
  process.env.JWT_SECRET,
  { expiresIn: '15m', algorithm: 'HS256' }
))")

curl -s http://localhost:3091/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{
        "protocolVersion":"2025-06-18","capabilities":{},
        "clientInfo":{"name":"curl","version":"0"}}}'
```

## Connect a client

The public endpoint is `https://mcp.fitaily.com/mcp`; locally it is
`http://localhost:3091/mcp`. Authentication is discovered automatically through
`/.well-known/oauth-protected-resource` and `/.well-known/oauth-authorization-server`.

**Claude Code**

```bash
claude mcp add --transport http fitaily https://mcp.fitaily.com/mcp
```

**Cursor / VS Code / generic JSON config**

```json
{
  "mcpServers": {
    "fitaily": { "type": "http", "url": "https://mcp.fitaily.com/mcp" }
  }
}
```

**OpenCode**

```json
{
  "mcp": {
    "fitaily": { "type": "remote", "url": "https://mcp.fitaily.com/mcp", "enabled": true }
  }
}
```

For Claude Desktop, add the remote connector through your Claude account’s **Customize → Connectors** page; remote connectors are managed there rather than through `claude_desktop_config.json`.

During OAuth the client registers itself dynamically, opens the Fitaily consent screen and
receives an access token whose `aud` must equal `MCP_RESOURCE_URL`. A mismatch is rejected
with `403 Token audience mismatch`.

## Configuration

| Variable               | Required         | Default                       | Purpose                                                                                      |
| ---------------------- | ---------------- | ----------------------------- | -------------------------------------------------------------------------------------------- |
| `JWT_SECRET`           | ✅               | —                             | Verifies HS256 access tokens. Must equal the backend value. `/mcp` returns `500` without it. |
| `MCP_RESOURCE_URL`     | ✅ in production | `https://mcp.fitaily.com/mcp` | Public endpoint URL **and** expected token audience. No trailing slash.                      |
| `FITAILY_API_URL`      | ✅               | `http://localhost:3001/api`   | Base URL of the REST API, including `/api`.                                                  |
| `OAUTH_ISSUER`         | ✅               | `https://fitaily.com`         | Authorization server issuer, used in discovery documents and the optional `iss` check.       |
| `PORT`                 |                  | `3091`                        | HTTP port.                                                                                   |
| `CORS_ORIGIN`          |                  | `*`                           | `*` or a comma-separated origin allowlist.                                                   |
| `TRUST_PROXY`          |                  | `1`                           | Reverse-proxy hops for client IP + `req.protocol` (one proxy/tunnel hop by default). Set `false` when directly exposed. |
| `MCP_BODY_LIMIT`       |                  | `1mb`                         | Max JSON body for `POST /mcp`.                                                               |
| `RATE_LIMIT_WINDOW_MS` |                  | `60000`                       | Rate-limit window per IP.                                                                    |
| `RATE_LIMIT_MAX`       |                  | `10000`                       | Shared-host ceiling per source IP on `/mcp`; set high enough for hosted MCP clients.          |
| `MCP_USER_RATE_LIMIT_MAX` |               | `300`                         | Authenticated requests per window per Fitaily user.                                           |
| `ACCESS_LOG`           |                  | `true`                        | `false` disables the method/path/status access log.                                          |

## Authentication and scopes

Tokens are HS256 JWTs with `userId`, `client_id`, `scope`, `aud`, `jti` and a 15-minute TTL.
The server pins `HS256`, checks `aud`, and verifies `iss` when the claim is present.

| Scope             | Unlocks                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `nutrition:read`  | meals, foods, water, recipes, diet plans, pantry, profile                                                                |
| `nutrition:write` | log/edit/delete meals and water, change goals, recipe CRUD, diet-plan generate/activate/extend, fridge and shopping list |
| `training:read`   | activities, plans, workout templates, exercise catalog, strength stats                                                   |
| `training:write`  | `log_activity`, workout template create/update/delete                                                                    |
| `progress:read`   | measurements, goals, aggregates, trends, forecasts                                                                       |
| `progress:write`  | add/update measurements and goals                                                                                        |

A `401` response carries `WWW-Authenticate: Bearer resource_metadata="…"` so clients can
find the authorization server. Missing scopes return `403 Missing scope: <scope>`.

**Write confirmation is a client responsibility.** The server marks mutating tools with
`readOnlyHint: false` and deletions with `destructiveHint: true`, but it cannot block a call
the model already decided to make. The bundled [skills](skills/) encode the
“show a summary → wait for yes → call the tool” workflow.

## Tools

Full reference with scopes and read/write/destructive labels: **[docs/tools.md](docs/tools.md)**.

| Group             | Tools | Highlights                                                             |
| ----------------- | ----- | ---------------------------------------------------------------------- |
| Nutrition         | 8     | today's totals, meal history, goals, meal suggestions, meal CRUD       |
| Foods             | 6     | catalog search, barcode lookup and personal product CRUD               |
| Water             | 3     | history, log, delete                                                   |
| Recipes           | 13    | public catalog, tags, favorites, ratings, CRUD, “fit remaining macros” |
| Diet plans        | 5     | list, detail, generate, activate, extend                               |
| Training          | 8     | history, plans, cardio logging, workout template CRUD                  |
| Exercise catalog  | 2     | search, detail                                                         |
| Strength stats    | 3     | personal records, exercise history, muscle activation                  |
| Progress          | 6     | summary, measurements, goals                                           |
| Stats             | 7     | nutrition/activity/measurement aggregates, history, trend, forecast    |
| Profile           | 3     | profile, coach plan, dashboard summary                                 |
| Fridge & shopping | 6     | fridge items, shopping list                                            |

## Architecture

```
client ──OAuth token──▶ POST /mcp
                         ├─ rate limit (per IP)
                         ├─ verify JWT (HS256, aud, scopes)
                         ├─ parse JSON (max 1 MB)
                         ├─ new McpServer + tools bound to the token
                         └─ fetch FITAILY_API_URL/... (10–15 s timeout)
```

- One server/transport per request: safe to run multiple replicas, no sticky sessions.
- No database, no queue, no disk writes; rate-limit counters live in process memory.
- The backend body is never returned to the model — only a stable status and a generic
  message, so an internal error cannot leak data or HTML.
- Backend quirks worth knowing before changing tools: [docs/backend-contract.md](docs/backend-contract.md).

## Development

```bash
pnpm dev             # tsx dev server on :3091 (loads .env when present)
pnpm test            # vitest (unit + HTTP integration)
pnpm typecheck       # src + tests
pnpm lint            # eslint 10 + typescript-eslint
pnpm format          # prettier
pnpm build           # tsc → dist/
pnpm validate:skills # SKILL.md frontmatter + tool names
```

```
src/
  api/         fetch wrapper for the Fitaily API
  auth/        JWT verification + scope checks
  schemas/     zod input schemas shared by all tools
  tools/       one file per domain (70 tools)
  config.ts    env parsing
  server.ts    express app, OAuth discovery, /mcp
tests/         vitest + supertest
docs/          tool reference and backend contract
skills/        agent skills that teach clients how to use the tools
```

**Adding or renaming a tool**

1. Add the zod schema in `src/schemas/common.ts`.
2. Register it in `src/tools/<domain>.ts` with a description that says when to call it,
   `annotations`, and the matching `requireScope`.
3. Add the row to `docs/tools.md` (the docs test fails otherwise).
4. Add or update a test in `tests/tools.test.ts` and, if it is a new workflow, a skill.
5. Run `pnpm lint && pnpm typecheck && pnpm test`.

## Self-hosting

```bash
docker build -t fitaily-mcp .
docker run --rm -p 3091:3091 --env-file .env fitaily-mcp
```

`docker-compose.yml` next to the backend:

```yaml
services:
  mcp:
    build: .
    env_file: .env
    restart: unless-stopped
    ports:
      - "3091:3091"
    # Same private network as the backend; FITAILY_API_URL can then use
    # http://backend:3001/api instead of a public hostname.
    networks:
      - fitaily

networks:
  fitaily:
    external: true
```

Put a TLS-terminating reverse proxy or tunnel in front of it and keep
`TRUST_PROXY=1`; the container runs as the unprivileged `node` user and exposes a
`HEALTHCHECK` against `/health`.

## Privacy and data handling

- The MCP server does not persist user records, prompts, tool results, tokens, or request bodies. It has no database or disk cache.
- By default, its access log records HTTP method, path, status, and request duration only. It does not include user IDs, OAuth tokens, prompts, or tool results; set `ACCESS_LOG=false` to disable it.
- Health and training data pass through the MCP process in memory to and from the Fitaily API for each request. The connected assistant receives the data returned for the user's request; the assistant provider's own privacy and retention terms also apply.
- The Fitaily backend stores account data under the [Fitaily Privacy Policy](https://fitaily.com/privacy-policy). OAuth access tokens last 15 minutes; refresh tokens last 30 days and rotate when used. Users can revoke an assistant's access in Fitaily's **Settings → AI Integrations**.
- Rate-limit counters are held in memory and disappear on restart.

## Security

Please report vulnerabilities privately — see [SECURITY.md](SECURITY.md). Do not open a
public issue for a suspected token leak or auth bypass.

Operational notes:

- `JWT_SECRET` is shared with the backend. Rotating it invalidates every outstanding token.
- Tokens are bearer credentials: never log them, never put them in a URL.
- Keep `MCP_RESOURCE_URL` exact; a trailing slash or wrong scheme breaks the audience check.
- The default IP ceiling is intentionally high because hosted clients can share egress IPs. The authenticated per-user limit is 300 requests per minute; tune both limits for your deployment.

## Design decisions

- **Generic `outputSchema`.** Every tool advertises `outputSchema: { type: "object" }` rather than 66
  per-tool field schemas. Tools return trimmed, purpose-built projections, and the real consumer benefit
  is `structuredContent` mirroring `content[0].text`. A per-tool schema would duplicate projections and
  break when the backend adds fields.
- **No streaming progress notifications.** Every call is a single backend round-trip (typically
  100–800 ms). If a future tool (e.g. AI diet plan generation) needs minutes, progress notifications
  can be added then without changing today's clients.
- **ESM modules.** The package is `"type": "module"` and compiled with `module: NodeNext`. This matches
  the modern Node/MCP ecosystem; the Docker image builds the TypeScript inside the container and ships
  only `dist/`.

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for the local
loop and the tool checklist.

## License

[Apache License 2.0](LICENSE) © 2026 Rafal Sipiatowski. See [NOTICE](NOTICE) for the
attribution notice. The license includes an express patent grant; modified files must carry
prominent change notices when redistributed.

Fitaily is a trademark of its owner. This repository is an independent integration; the
Fitaily backend and mobile apps are not part of it.
