import JWT from "jsonwebtoken";
import { mcpResourceUrl, oauthIssuer } from "../config.js";

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

/** Shape of a Fitaily access JWT payload; everything else is ignored. */
interface DecodedToken {
  userId?: string;
  client_id?: string;
  scope?: string;
  aud?: string | string[];
  iss?: string;
  [key: string]: unknown;
}

/** Verify the OAuth access JWT, algorithm, audience and expiry. Never trusts model input. */
export function verifyMcpToken(bearer: string | undefined): McpAuth {
  if (!bearer || !bearer.startsWith("Bearer ")) {
    throw new McpAuthError(401, "Missing bearer token");
  }
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new McpAuthError(500, "JWT_SECRET is not configured");
  try {
    // Pin HS256: the backend signs with HS256 and a shared secret, so accepting
    // other algorithms (or `none`) would widen the attack surface for free.
    const decoded = JWT.verify(bearer.slice(7), secret, { algorithms: ["HS256"] }) as DecodedToken;
    const audiences = Array.isArray(decoded.aud) ? decoded.aud : decoded.aud ? [decoded.aud] : [];
    if (!audiences.includes(mcpResourceUrl())) {
      throw new McpAuthError(403, "Token audience mismatch");
    }
    // Fitaily access tokens do not carry `iss` yet; verify it when present so a
    // token minted by another issuer with the same secret is still rejected.
    if (decoded.iss !== undefined && decoded.iss !== oauthIssuer()) {
      throw new McpAuthError(403, "Token issuer mismatch");
    }
    if (!decoded.userId) throw new McpAuthError(401, "Invalid token subject");
    return {
      userId: String(decoded.userId),
      clientId: String(decoded.client_id || "unknown"),
      scopes: new Set(
        String(decoded.scope || "")
          .split(/\s+/)
          .filter(Boolean),
      ),
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
