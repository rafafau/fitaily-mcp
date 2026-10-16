import express from "express";
import helmet from "helmet";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/server";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import { mcpResourceUrl, oauthIssuer } from "./config";
import { McpAuthError, verifyMcpToken } from "./auth/verify";
import { registerNutritionTools } from "./tools/nutrition";
import { registerTrainingTools } from "./tools/training";
import { registerProgressTools } from "./tools/progress";

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ success: true, service: "fitaily-mcp", timestamp: new Date().toISOString() });
});

// RFC 9728 Protected Resource Metadata — tells ChatGPT/Claude where the AS is.
app.get("/.well-known/oauth-protected-resource", (_req, res) => {
  res.json({
    resource: mcpResourceUrl(),
    authorization_servers: [oauthIssuer()],
    scopes_supported: ["nutrition:read", "training:read", "progress:read"],
  });
});

// Also serve it under /mcp well-known path variant some clients probe.
app.get("/.well-known/oauth-protected-resource/mcp", (_req, res) => {
  res.redirect(308, "/.well-known/oauth-protected-resource");
});

// Stateless Streamable HTTP: auth first, then one server+transport per request.
app.post("/mcp", async (req, res) => {
  let auth;
  try {
    auth = verifyMcpToken(req.headers.authorization);
  } catch (err) {
    const status = err instanceof McpAuthError ? err.status : 401;
    res.status(status).json({ error: err instanceof Error ? err.message : "Unauthorized" });
    return;
  }
  const accessToken = req.headers.authorization!.slice(7);
  try {
    const server = new McpServer({ name: "fitaily", version: "0.1.0" }, { capabilities: { tools: {} } });
    registerNutritionTools(server, auth, accessToken);
    registerTrainingTools(server, auth, accessToken);
    registerProgressTools(server, auth, accessToken);
    const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch {
    if (!res.headersSent) res.status(500).json({ error: "MCP request failed" });
  }
});

// Method-not-allowed hint for GET /mcp probes.
app.get("/mcp", (_req, res) => {
  res.status(405).json({ error: "Use POST /mcp with Streamable HTTP" });
});

export default app;
