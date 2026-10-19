import express from "express";
import helmet from "helmet";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/server";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import { mcpResourceUrl, oauthIssuer, port } from "./config";
import { McpAuthError, verifyMcpToken } from "./auth/verify";
import { registerNutritionTools } from "./tools/nutrition";
import { registerFoodTools } from "./tools/foods";
import { registerWaterTools } from "./tools/water";
import { registerTrainingTools } from "./tools/training";
import { registerProgressTools } from "./tools/progress";
import { registerRecipeTools } from "./tools/recipes";
import { registerDietPlanTools } from "./tools/dietPlans";
import { registerProfileTools } from "./tools/profile";
import { registerStatsTools } from "./tools/stats";
import { registerStrengthStatsTools } from "./tools/strengthStats";
import { registerPantryTools } from "./tools/pantry";
import { registerExerciseTools } from "./tools/exercises";

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Minimal access log (method/path/status only — never tokens or bodies).
// The MCP SDK gives no request log; without this, client discovery failures
// are invisible (lesson from the Claude DCR failure, 2026-10-16).
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

app.get("/health", (_req, res) => {
  res.json({ success: true, service: "fitaily-mcp", timestamp: new Date().toISOString() });
});

// RFC 9728 Protected Resource Metadata — tells ChatGPT/Claude where the AS is.
app.get("/.well-known/oauth-protected-resource", (_req, res) => {
  res.json({
    resource: mcpResourceUrl(),
    authorization_servers: [oauthIssuer()],
    scopes_supported: [
      "nutrition:read",
      "training:read",
      "progress:read",
      "nutrition:write",
      "training:write",
      "progress:write",
    ],
  });
});

// RFC 8414 Authorization Server Metadata, served directly (200, no redirect)
// for clients that probe the resource server first instead of following the
// `authorization_servers` link in the protected-resource document.
app.get("/.well-known/oauth-authorization-server", (_req, res) => {
  const issuer = oauthIssuer();
  res.json({
    issuer,
    authorization_endpoint: `${issuer}/api/oauth/authorize`,
    token_endpoint: `${issuer}/api/oauth/token`,
    registration_endpoint: `${issuer}/api/oauth/register`,
    revocation_endpoint: `${issuer}/api/oauth/revoke`,
    introspection_endpoint: `${issuer}/api/oauth/introspect`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: [
      "nutrition:read",
      "training:read",
      "progress:read",
      "nutrition:write",
      "training:write",
      "progress:write",
    ],
    token_endpoint_auth_methods_supported: ["none"],
  });
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
    const server = new McpServer({ name: "fitaily", version: "0.2.0" }, { capabilities: { tools: {} } });
    registerNutritionTools(server, auth, accessToken);
    registerFoodTools(server, auth, accessToken);
    registerWaterTools(server, auth, accessToken);
    registerTrainingTools(server, auth, accessToken);
    registerProgressTools(server, auth, accessToken);
    registerRecipeTools(server, auth, accessToken);
    registerDietPlanTools(server, auth, accessToken);
    registerProfileTools(server, auth, accessToken);
    registerStatsTools(server, auth, accessToken);
    registerStrengthStatsTools(server, auth, accessToken);
    registerPantryTools(server, auth, accessToken);
    registerExerciseTools(server, auth, accessToken);
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
