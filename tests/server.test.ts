import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { sign } from "jsonwebtoken";
import type { Express } from "express";

process.env.JWT_SECRET = "test-secret";
process.env.MCP_RESOURCE_URL = "https://mcp.example.com/mcp";
process.env.OAUTH_ISSUER = "https://issuer.example.com";
process.env.RATE_LIMIT_MAX = "10000";
process.env.ACCESS_LOG = "false";

const SECRET = "test-secret";
const RESOURCE = "https://mcp.example.com/mcp";

function bearer(overrides: Record<string, unknown> = {}): string {
  const token = sign({ userId: "u1", scope: "nutrition:read", aud: RESOURCE, ...overrides }, SECRET, {
    expiresIn: "15m",
    algorithm: "HS256",
  } as any);
  return `Bearer ${token}`;
}

let app: Express;

function parseRpc(res: { text: string; body: any }): any {
  return res.text && res.text.includes("data: ") ? JSON.parse(res.text.split("data: ")[1]) : res.body;
}

beforeAll(async () => {
  app = (await import("../src/server")).default;
});

describe("service endpoints", () => {
  it("reports health with the package version", async () => {
    const res = await request(app).get("/health").expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.version).toBe("0.2.0");
  });

  it("serves RFC 9728 protected resource metadata", async () => {
    const res = await request(app).get("/.well-known/oauth-protected-resource").expect(200);
    expect(res.body.resource).toBe(RESOURCE);
    expect(res.body.authorization_servers).toEqual(["https://issuer.example.com"]);
    expect(res.body.scopes_supported).toContain("nutrition:write");
    expect(res.body.bearer_methods_supported).toEqual(["header"]);
  });

  it("serves the path-suffixed metadata document", async () => {
    const res = await request(app).get("/.well-known/oauth-protected-resource/mcp").expect(200);
    expect(res.body.resource).toBe(RESOURCE);
  });

  it("serves RFC 8414 authorization server metadata", async () => {
    const res = await request(app).get("/.well-known/oauth-authorization-server").expect(200);
    expect(res.body.issuer).toBe("https://issuer.example.com");
    expect(res.body.token_endpoint).toBe("https://issuer.example.com/api/oauth/token");
    expect(res.body.code_challenge_methods_supported).toEqual(["S256"]);
  });
});

describe("POST /mcp auth", () => {
  it("rejects requests without a token and advertises the metadata URL", async () => {
    const res = await request(app).post("/mcp").send({}).expect(401);
    expect(res.body.error).toMatch(/bearer token/i);
    expect(res.headers["www-authenticate"]).toContain("resource_metadata=");
    expect(res.headers["www-authenticate"]).toContain("/.well-known/oauth-protected-resource");
  });

  it("rejects a token minted for another audience", async () => {
    const res = await request(app)
      .post("/mcp")
      .set("Authorization", bearer({ aud: "https://evil.test/mcp" }))
      .send({})
      .expect(403);
    expect(res.body.error).toMatch(/audience/i);
  });

  it("rejects a token signed with another secret", async () => {
    const token = sign({ userId: "u1", scope: "nutrition:read", aud: RESOURCE }, "other-secret", {
      expiresIn: "15m",
      algorithm: "HS256",
    } as any);
    await request(app).post("/mcp").set("Authorization", `Bearer ${token}`).send({}).expect(401);
  });

  it("returns JSON (not HTML) for a malformed body", async () => {
    const res = await request(app)
      .post("/mcp")
      .set("Authorization", bearer())
      .set("Content-Type", "application/json")
      .send("{not-json")
      .expect(400);
    expect(res.body.error).toMatch(/malformed/i);
  });

  it("answers GET /mcp with 405 and an Allow header", async () => {
    const res = await request(app).get("/mcp").expect(405);
    expect(res.headers.allow).toBe("POST");
  });

  it("completes an initialize handshake", async () => {
    const res = await request(app)
      .post("/mcp")
      .set("Authorization", bearer())
      .set("Accept", "application/json, text/event-stream")
      .send({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "vitest", version: "1.0.0" },
        },
      })
      .expect(200);
    const body = parseRpc(res);
    expect(body.result.serverInfo.name).toBe("fitaily");
  });
});

describe("tools over the wire", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("advertises an output schema for every tool", async () => {
    const res = await request(app)
      .post("/mcp")
      .set("Authorization", bearer())
      .set("Accept", "application/json, text/event-stream")
      .send({ jsonrpc: "2.0", id: 2, method: "tools/list" })
      .expect(200);
    const body = parseRpc(res);
    expect(body.result.tools).toHaveLength(66);
    for (const tool of body.result.tools) {
      expect(tool.outputSchema, tool.name).toMatchObject({ type: "object" });
    }
  });

  it("returns structuredContent alongside the text block", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ data: { dailyCaloriesGoal: 2200, proteinGoal: 150 } }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
      ),
    );
    const res = await request(app)
      .post("/mcp")
      .set("Authorization", bearer())
      .set("Accept", "application/json, text/event-stream")
      .send({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "get_nutrition_goals", arguments: {} },
      })
      .expect(200);
    const body = parseRpc(res);
    expect(body.result.isError).not.toBe(true);
    expect(body.result.structuredContent).toEqual({ dailyCaloriesGoal: 2200, proteinGoal: 150 });
    expect(JSON.parse(body.result.content[0].text)).toEqual(body.result.structuredContent);
  });
});
