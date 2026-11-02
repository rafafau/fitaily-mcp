# Security policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Report privately through GitHub Security Advisories
(<https://github.com/rafafau/fitaily-mcp/security/advisories/new>) or by email to the
maintainer listed on the GitHub profile. Include:

- the affected endpoint or tool,
- steps to reproduce,
- impact (token leak, auth bypass, data exposure, denial of service),
- the version or commit you tested.

You will get an acknowledgement within 72 hours. Please give us time to ship a fix before
disclosing the issue publicly.

## Scope

In scope:

- JWT verification (`src/auth/verify.ts`) — algorithm, audience, issuer, expiry, scopes.
- OAuth discovery documents and the `WWW-Authenticate` challenge.
- Authorization bypass in any tool, including cross-user access through ids.
- Leakage of tokens, backend bodies or personal data in responses or logs.
- Rate-limit or body-size bypasses.

Out of scope:

- Vulnerabilities in the Fitaily backend or mobile apps (report them through Fitaily's own
  channel).
- Issues that require a valid token with more scopes than the user consented to.
- Denial of service through a deliberately huge number of parallel requests from many IPs.

## Security model

- Every `/mcp` request needs `Authorization: Bearer <JWT>`.
- Tokens must be HS256, signed with `JWT_SECRET`, addressed to `MCP_RESOURCE_URL`, and not
  expired. `iss` is verified when present.
- Each tool additionally calls `requireScope` before touching the backend.
- The server is stateless and stores no user data. Access logs never contain tokens or
  request bodies.
- The backend response body is never forwarded to the model; only a status-derived message
  is returned.

## Operational guidance

- Use a long random `JWT_SECRET` (32+ bytes) shared only with the backend.
- Terminate TLS in front of the service and keep `TRUST_PROXY` aligned with your topology.
- Rotate `JWT_SECRET` if it leaks — this invalidates all outstanding tokens immediately.
- Keep dependencies current; Dependabot is enabled for this repository.
