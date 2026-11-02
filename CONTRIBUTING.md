# Contributing

Thanks for taking the time to contribute. This is a small, stateless adapter — the bar is
“does it make the tools clearer or safer for a model and a user”, not “does it add a
feature”.

## Local loop

```bash
corepack enable
pnpm install
pnpm dev          # :3091
pnpm test
pnpm lint
pnpm typecheck
pnpm validate:skills
```

Before opening a PR, all of these must pass. CI runs the same commands on Node 24.

## Adding a tool

1. Add the input schema to `src/schemas/common.ts` (zod, with `.describe()` on anything a
   model could misread).
2. Register the tool in the matching `src/tools/*.ts` file:
   - a description that says **when** to call it and what it returns,
   - `outputSchema: JsonObjectOutput` (shared, imported from `src/utils/result.ts`),
   - `annotations` (`readOnlyHint`, `destructiveHint`, `idempotentHint`),
   - `requireScope(auth, "...")` as the first statement of the handler,
   - return `jsonResult(payload)` (or `jsonResult(payload, { isError: true })`) — never
     hand-build `content` blocks, or `structuredContent` and the text block will drift.
3. Add the row to `docs/tools.md` — `tests/docs.test.ts` fails if a tool is missing or
   orphaned.
4. Cover the happy path and the scope check in `tests/tools.test.ts`.
5. If the tool unlocks a new user workflow, add or extend a skill in `skills/`.

## Changing tool names or output

Tool names and output shapes are a public API: clients and skills depend on them. Rename
calls out the old name in the PR description and updates `docs/tools.md`, the tests and
every skill in the same commit.

## Style

- Prettier and ESLint decide formatting. `pnpm format` before committing.
- Prefer explicit types at module boundaries; `any` is tolerated only for raw backend
  payloads that are immediately trimmed.
- Error messages must be safe to show to a user: no stack traces, no backend bodies, no
  tokens, no internal hostnames.

## Commits and PRs

- One logical change per PR; keep diffs reviewable.
- Explain the user-visible effect, not the mechanics.
- Security fixes: follow [SECURITY.md](SECURITY.md) instead of a public PR until a fix is
  released.
