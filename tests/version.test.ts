import { describe, expect, it } from "vitest";
import pkg from "../package.json";
import { SERVER_VERSION } from "../src/config.js";

describe("version", () => {
  it("keeps the MCP serverInfo version in sync with package.json", () => {
    expect(SERVER_VERSION).toBe(pkg.version);
  });
});
