import type { Request } from "express";
import { rateLimit } from "express-rate-limit";
import { userRateLimitMax, rateLimitWindowMs } from "../config.js";

type AuthenticatedRequest = Request & { mcpAuth?: { userId: string } };

/** Apply the authenticated request budget per Fitaily user, not per host IP. */
export function createMcpUserLimiter(limit = userRateLimitMax()) {
  return rateLimit({
    windowMs: rateLimitWindowMs(),
    limit,
    keyGenerator: (req) => {
      const userId = (req as AuthenticatedRequest).mcpAuth?.userId;
      return userId ? `mcp-user:${userId}` : "mcp-user:missing";
    },
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many requests" },
  });
}
