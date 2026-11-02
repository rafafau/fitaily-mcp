import type { CallToolResult } from "@modelcontextprotocol/server";
import { z } from "zod";

/**
 * Every tool returns a JSON object with tool-specific fields. A per-tool schema
 * would duplicate the very projections the tools already trim, so the catalog
 * advertises the widest useful contract: "an object". Clients that validate can
 * still rely on `structuredContent` being an object.
 */
export const JsonObjectOutput = z.looseObject({});

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * One result shape for all 66 tools:
 *  - `content[0].text` keeps the wire format for text-only clients,
 *  - `structuredContent` mirrors the same JSON for clients that parse results,
 *  - both are derived from one `JSON.stringify`, so they cannot drift.
 */
export function jsonResult(data: unknown, extra?: { isError?: boolean }): CallToolResult {
  const text = JSON.stringify(data);
  const parsed: unknown = JSON.parse(text);
  return {
    content: [{ type: "text", text }],
    structuredContent: isPlainObject(parsed) ? parsed : { data: parsed },
    ...(extra?.isError ? { isError: true } : {}),
  };
}
