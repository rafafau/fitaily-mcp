# Fitaily MCP server (Etap 1 — read-only)

Remote MCP over Streamable HTTP. No business logic, no DB access —
every tool calls the existing Fitaily REST API with the user's OAuth token.

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

## Infra

Separate container on the Pi (`fitaily-shared` network), Cloudflare Tunnel
hostname `mcp.fitaily.com` → `fitaily-mcp:3091`. Tunnel path routing for
`fitaily.com` is untouched.
