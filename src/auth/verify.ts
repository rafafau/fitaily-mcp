import { verify } from "jsonwebtoken";
import { mcpResourceUrl } from "../config";

export interface McpAuth {
  userId: string;
  scopes: Set<string>;
  clientId: string;
}

export class McpAuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Verify the OAuth access JWT, audience and expiry. Never trusts model input. */
export function verifyMcpToken(bearer: string | undefined): McpAuth {
  if (!bearer || !bearer.startsWith("Bearer ")) {
    throw new McpAuthError(401, "Missing bearer token");
  }
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new McpAuthError(500, "JWT_SECRET is not configured");
  try {
    const decoded = verify(bearer.slice(7), secret) as any;
    const expectedAud = mcpResourceUrl();
    const aud = Array.isArray(decoded.aud) ? decoded.aud[0] : decoded.aud;
    if (aud !== expectedAud) throw new McpAuthError(403, "Token audience mismatch");
    if (!decoded.userId) throw new McpAuthError(401, "Invalid token subject");
    return {
      userId: String(decoded.userId),
      clientId: String(decoded.client_id || "unknown"),
      scopes: new Set(String(decoded.scope || "").split(/\s+/).filter(Boolean)),
    };
  } catch (err) {
    if (err instanceof McpAuthError) throw err;
    throw new McpAuthError(401, "Invalid or expired token");
  }
}

export function requireScope(auth: McpAuth, scope: string): void {
  if (!auth.scopes.has(scope)) {
    throw new McpAuthError(403, `Missing scope: ${scope}`);
  }
}
