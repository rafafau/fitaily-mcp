import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const TOOLS_DIR = join(ROOT, "src", "tools");
const DOCS = join(ROOT, "docs", "tools.md");

function registeredToolNames(): string[] {
  const names: string[] = [];
  for (const file of readdirSync(TOOLS_DIR).filter((f) => f.endsWith(".ts"))) {
    const source = readFileSync(join(TOOLS_DIR, file), "utf8");
    for (const match of source.matchAll(/registerTool\(\s*"([a-z0-9_]+)"/g)) {
      names.push(match[1]);
    }
  }
  return names;
}

describe("docs/tools.md", () => {
  const names = registeredToolNames();
  const docs = readFileSync(DOCS, "utf8");

  it("documents every registered tool", () => {
    const missing = names.filter((name) => !docs.includes(`\`${name}\``));
    expect(missing).toEqual([]);
  });

  it("does not document tools that no longer exist", () => {
    const documented = [...docs.matchAll(/^\| `([a-z0-9_]+)`/gm)].map((m) => m[1]);
    expect(documented.filter((name) => !names.includes(name))).toEqual([]);
  });

  it("has a description for every row", () => {
    const rows = [...docs.matchAll(/^\| `([a-z0-9_]+)` \| (.+?) \| `[a-z:]+` \| (read|write|destructive) \|$/gm)];
    expect(new Set(rows.map((r) => r[1]))).toEqual(new Set(names));
    expect(rows.length).toBe(names.length);
    for (const [, name, description] of rows) {
      expect(description.trim(), name).not.toBe("");
    }
  });

  it("has no duplicate registrations", () => {
    expect(new Set(names).size).toBe(names.length);
  });
});
