import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { sign } from "jsonwebtoken";
import { verifyMcpToken, requireScope, McpAuthError } from "../src/auth/verify";

const SECRET = "test-secret";
const RESOURCE = "https://mcp.fitaily.com/mcp";

function token(overrides: Record<string, unknown> = {}): string {
  return sign({ userId: "u1", scope: "nutrition:read training:read", aud: RESOURCE, ...overrides }, SECRET, {
    expiresIn: "15m",
    algorithm: "HS256",
  } as any);
}

describe("verifyMcpToken", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = SECRET;
    process.env.MCP_RESOURCE_URL = RESOURCE;
  });
  afterEach(() => vi.unstubAllGlobals());

  it("accepts a valid token with scopes", () => {
    const auth = verifyMcpToken(`Bearer ${token()}`);
    expect(auth.userId).toBe("u1");
    expect(auth.scopes.has("nutrition:read")).toBe(true);
  });

  it("rejects wrong audience (never trust model input)", () => {
    expect(() => verifyMcpToken(`Bearer ${token({ aud: "https://evil.test/mcp" })}`)).toThrowError(McpAuthError);
  });

  it("rejects missing header", () => {
    expect(() => verifyMcpToken(undefined)).toThrowError(McpAuthError);
  });

  it("requireScope enforces per-tool scopes", () => {
    const auth = verifyMcpToken(`Bearer ${token()}`);
    expect(() => requireScope(auth, "progress:read")).toThrowError(McpAuthError);
  });
});
