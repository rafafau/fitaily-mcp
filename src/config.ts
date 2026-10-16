export function fitailyApiUrl(): string {
  return (process.env.FITAILY_API_URL || "http://localhost:3001/api").replace(/\/+$/, "");
}

export function mcpResourceUrl(): string {
  return (process.env.MCP_RESOURCE_URL || "https://mcp.fitaily.com/mcp").replace(/\/+$/, "");
}

export function oauthIssuer(): string {
  return (process.env.OAUTH_ISSUER || "https://fitaily.com").replace(/\/+$/, "");
}

export function port(): number {
  return Number(process.env.PORT || 3091);
}
