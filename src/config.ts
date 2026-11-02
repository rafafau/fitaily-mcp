export const SERVER_NAME = "fitaily";
export const SERVER_VERSION = "0.2.0";

/** Strip trailing slashes so `${base}${path}` never doubles them. */
function baseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

export function fitailyApiUrl(): string {
  return baseUrl(process.env.FITAILY_API_URL || "http://localhost:3001/api");
}

export function mcpResourceUrl(): string {
  return baseUrl(process.env.MCP_RESOURCE_URL || "https://mcp.fitaily.com/mcp");
}

export function oauthIssuer(): string {
  return baseUrl(process.env.OAUTH_ISSUER || "https://fitaily.com");
}

export function port(): number {
  return Number(process.env.PORT || 3091);
}

/** `*` (default) or a comma-separated allowlist of origins. */
export function corsOrigin(): string | string[] {
  const raw = (process.env.CORS_ORIGIN || "*").trim();
  if (raw === "*") return "*";
  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/**
 * Number of reverse proxies to trust (default 1: one proxy/tunnel hop).
 * Needed for the client IP in rate limiting and for the https scheme in
 * `req.protocol`. Set `TRUST_PROXY=false` when the process is directly exposed.
 */
export function trustProxy(): number | boolean {
  const raw = process.env.TRUST_PROXY;
  if (raw === undefined || raw === "") return 1;
  if (raw === "true") return true;
  if (raw === "false") return false;
  const hops = Number(raw);
  return Number.isFinite(hops) ? hops : 1;
}

export function bodyLimit(): string {
  return process.env.MCP_BODY_LIMIT || "1mb";
}

export function rateLimitWindowMs(): number {
  return Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
}

export function rateLimitMax(): number {
  return Number(process.env.RATE_LIMIT_MAX || 300);
}

export function accessLogEnabled(): boolean {
  return process.env.ACCESS_LOG !== "false";
}
