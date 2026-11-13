import express, { type Request } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createMcpUserLimiter } from "../src/middleware/mcp-user-limiter.js";

describe("authenticated MCP rate limit", () => {
  it("allows concurrent requests from separate users and limits repeat calls per user", async () => {
    const app = express();
    app.use((req, _res, next) => {
      (req as Request & { mcpAuth?: { userId: string } }).mcpAuth = { userId: req.header("x-user-id") ?? "missing" };
      next();
    });
    app.use(createMcpUserLimiter(1));
    app.get("/mcp", (_req, res) => res.sendStatus(200));

    const results = await Promise.all(
      Array.from({ length: 20 }, (_, index) => request(app).get("/mcp").set("x-user-id", `user-${index}`)),
    );
    expect(results.map((result) => result.status)).toEqual(Array(20).fill(200));
    await request(app).get("/mcp").set("x-user-id", "user-0").expect(429);
  });
});
