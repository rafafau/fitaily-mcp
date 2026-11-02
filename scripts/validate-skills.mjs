#!/usr/bin/env node
/**
 * Validates skills/<name>/SKILL.md:
 *  - frontmatter with name + description,
 *  - name matches the directory and the Agent Skills naming rules,
 *  - description says when to use it and stays under 1024 characters,
 *  - every backticked snake_case tool name exists in src/tools,
 *  - no obvious secrets,
 *  - absolute main-branch links point at real files.
 *
 * Run with `pnpm validate:skills`; CI runs it too.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKILLS_DIR = join(ROOT, "skills");
const TOOLS_DIR = join(ROOT, "src", "tools");
const REPO_URL = "https://github.com/rafafau/fitaily-mcp/blob/main/";

function fail(file, message) {
  errors.push(`${file}: ${message}`);
}

const errors = [];
const warnings = [];

function knownTools() {
  const names = new Set();
  for (const file of readdirSync(TOOLS_DIR).filter((f) => f.endsWith(".ts"))) {
    const source = readFileSync(join(TOOLS_DIR, file), "utf8");
    for (const match of source.matchAll(/registerTool\(\s*"([a-z0-9_]+)"/g)) names.add(match[1]);
  }
  return names;
}

function parseFrontmatter(source) {
  if (!source.startsWith("---\n")) return null;
  const end = source.indexOf("\n---", 4);
  if (end === -1) return null;
  const block = source.slice(4, end);
  const fields = {};
  for (const line of block.split("\n")) {
    const match = line.match(/^([a-z_]+):\s*(.*)$/);
    if (match) fields[match[1]] = match[2].trim();
  }
  return fields;
}

const tools = knownTools();
const skillDirs = readdirSync(SKILLS_DIR).filter((entry) => {
  if (entry === "_template" || entry.startsWith("_")) return false;
  return statSync(join(SKILLS_DIR, entry)).isDirectory();
});

if (skillDirs.length === 0) errors.push("skills/: no skills found");

for (const dir of skillDirs) {
  const file = join(SKILLS_DIR, dir, "SKILL.md");
  const label = `skills/${dir}`;
  if (!existsSync(file)) {
    fail(label, "missing SKILL.md");
    continue;
  }
  const source = readFileSync(file, "utf8");
  const meta = parseFrontmatter(source);
  if (!meta) {
    fail(label, "missing YAML frontmatter");
    continue;
  }
  if (!meta.name) fail(label, "frontmatter.name is required");
  if (!meta.description) fail(label, "frontmatter.description is required");

  if (meta.name && meta.name !== dir) fail(label, `frontmatter.name "${meta.name}" != directory name`);
  if (meta.name && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(meta.name)) {
    fail(label, "name must be lowercase-hyphenated");
  }
  if (meta.name && meta.name.length > 64) fail(label, "name is longer than 64 characters");

  if (meta.description) {
    if (meta.description.length > 1024) fail(label, "description is longer than 1024 characters");
    if (!/\buse when\b/i.test(meta.description)) fail(label, 'description should start with "Use when ..."');
  }

  for (const match of source.matchAll(/`([a-z][a-z0-9]*_[a-z0-9_]+)`/g)) {
    if (!tools.has(match[1])) fail(label, `unknown tool name "${match[1]}"`);
  }

  if (/sk-[A-Za-z0-9]{16,}|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|Bearer eyJ[A-Za-z0-9._-]{10,}/.test(source)) {
    fail(label, "looks like a secret is embedded in the skill");
  }

  for (const match of source.matchAll(
    new RegExp(`${REPO_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^)\\s#]+)`, "g"),
  )) {
    const target = join(ROOT, match[1]);
    if (!existsSync(target)) fail(label, `link points at a missing file: ${match[1]}`);
  }

  if (source.split("\n").length > 400) warnings.push(`${label}: SKILL.md is long; consider references/`);
  console.log(`ok  ${label}`);
}

for (const warning of warnings) console.warn(`warn ${warning}`);
if (errors.length > 0) {
  for (const error of errors) console.error(`error ${error}`);
  console.error(`\n${errors.length} error(s) in ${skillDirs.length} skill(s)`);
  process.exit(1);
}
console.log(`\n${skillDirs.length} skill(s) valid (${tools.size} tools in the catalog)`);
