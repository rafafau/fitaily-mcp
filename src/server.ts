import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import { McpServer } from "@modelcontextprotocol/server";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import {
  SERVER_NAME,
  SERVER_VERSION,
  accessLogEnabled,
  bodyLimit,
  corsOrigin,
  mcpResourceUrl,
  oauthIssuer,
  rateLimitMax,
  rateLimitWindowMs,
  trustProxy,
} from "./config.js";
import { McpAuthError, verifyMcpToken, type McpAuth } from "./auth/verify.js";
import { registerNutritionTools } from "./tools/nutrition.js";
import { registerFoodTools } from "./tools/foods.js";
import { registerWaterTools } from "./tools/water.js";
import { registerTrainingTools } from "./tools/training.js";
import { registerProgressTools } from "./tools/progress.js";
import { registerRecipeTools } from "./tools/recipes.js";
import { registerDietPlanTools } from "./tools/dietPlans.js";
import { registerProfileTools } from "./tools/profile.js";
import { registerStatsTools } from "./tools/stats.js";
import { registerStrengthStatsTools } from "./tools/strengthStats.js";
import { registerPantryTools } from "./tools/pantry.js";
import { registerExerciseTools } from "./tools/exercises.js";

type AuthedRequest = Request & { mcpAuth?: McpAuth; accessToken?: string };

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", trustProxy());
app.use(helmet());
app.use(cors({ origin: corsOrigin() }));

if (accessLogEnabled()) {
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
}

app.get("/health", (_req, res) => {
  res.json({ success: true, service: SERVER_NAME, version: SERVER_VERSION, timestamp: new Date().toISOString() });
});

const SCOPES = [
  "nutrition:read",
  "training:read",
  "progress:read",
  "nutrition:write",
  "training:write",
  "progress:write",
];

/** RFC 9728 Protected Resource Metadata — tells ChatGPT/Claude where the AS is. */
function protectedResourceMetadata(_req: Request, res: Response): void {
  res.json({
    resource: mcpResourceUrl(),
    authorization_servers: [oauthIssuer()],
    bearer_methods_supported: ["header"],
    scopes_supported: SCOPES,
  });
}

app.get("/.well-known/oauth-protected-resource", protectedResourceMetadata);
// RFC 9728 path-suffixed form for a resource that lives under `/mcp`.
app.get("/.well-known/oauth-protected-resource/mcp", protectedResourceMetadata);

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
    scopes_supported: SCOPES,
    token_endpoint_auth_methods_supported: ["none"],
  });
});

/** Absolute URL clients can fetch to discover the AS (RFC 9728 §5.1). */
function resourceMetadataUrl(req: Request): string {
  const origin = `${req.protocol}://${req.get("host")}`;
  return new URL("/.well-known/oauth-protected-resource", origin).toString();
}

function authenticate(req: Request, res: Response, next: NextFunction): void {
  try {
    const authed = req as AuthedRequest;
    authed.mcpAuth = verifyMcpToken(req.headers.authorization);
    authed.accessToken = req.headers.authorization!.slice(7);
    next();
  } catch (err) {
    const e = err as Error;
    const status = e instanceof McpAuthError ? (e as McpAuthError).status : 401;
    const message = e instanceof Error ? e.message : "Unauthorized";
    res.setHeader("WWW-Authenticate", `Bearer resource_metadata="${resourceMetadataUrl(req)}"`);
    res.status(status).json({ error: message });
  }
}

const mcpLimiter = rateLimit({
  windowMs: rateLimitWindowMs(),
  limit: rateLimitMax(),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many requests" },
});

// Stateless Streamable HTTP: rate limit → auth → parse body → one server+transport per request.
// Auth runs before JSON parsing so unauthenticated clients cannot make the
// process buffer a megabyte of body per request.
app.post("/mcp", mcpLimiter, authenticate, express.json({ limit: bodyLimit() }), async (req, res) => {
  const { mcpAuth: auth, accessToken } = req as AuthedRequest;
  if (!auth || !accessToken) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION }, { capabilities: { tools: {} } });
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
  } catch (err) {
    console.error("MCP request failed:", err instanceof Error ? err.message : err);
    if (!res.headersSent) res.status(500).json({ error: "MCP request failed" });
  }
});

// Method-not-allowed hint for GET /mcp probes.
app.get("/mcp", (_req, res) => {
  res.setHeader("Allow", "POST");
  res.status(405).json({ error: "Use POST /mcp with Streamable HTTP" });
});

// Body-parser errors (malformed JSON, oversized payload) must stay JSON so
// clients do not have to parse Express' HTML error page.
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = Number(err?.status ?? err?.statusCode ?? 500);
  if (status === 413) {
    res.status(413).json({ error: "Request body too large" });
    return;
  }
  if (status >= 400 && status < 500) {
    res.status(400).json({ error: "Malformed request body" });
    return;
  }
  console.error("Unhandled error:", err instanceof Error ? err.message : err);
  res.status(500).json({ error: "Internal server error" });
});

export default app;
