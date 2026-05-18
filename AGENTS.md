# Repository Guidelines

## Project Structure & Module Organization

This is a TypeScript Cloudflare Worker built with Hono. Runtime code lives in `src/`, with `src/index.ts` as the Worker entry point. Keep new code near its responsibility:

- `src/cards/` renders SVG cards.
- `src/fetchers/` talks to GitHub and prepares stats data.
- `src/routes/` defines request handlers.
- `src/themes/` contains theme definitions.
- `src/utils/` holds shared helpers.

Tests live in `tests/` and are organized by feature, for example `tests/top-langs.test.ts` and `tests/edge-cache.test.ts`. Generated or deployment output belongs in `dist/`, while Cloudflare configuration is in `wrangler.jsonc`.

## Build, Test, and Development Commands

Use Node.js `>=22.12.0`.

```bash
npm run dev        # start local Wrangler dev server
npm run typecheck  # regenerate Worker types and run tsc --noEmit
npm run test       # run Vitest in watch mode
npm run test-run   # run Vitest once, as CI does
npm run lint       # check src/ and tests/ with oxlint
npm run format     # verify formatting with oxfmt
npm run build      # run a Wrangler dry-run build into dist/
```

Before opening a PR, prefer `npm run pre-commit`; it runs typechecking, lint fixes, and formatting fixes in one pass.

## Coding Style & Naming Conventions

Follow `.oxfmtrc.json`: 2-space indentation, single quotes, no semicolons, trailing commas where valid, and a 120-character print width. `oxlint` enforces `.oxlintrc.json`; avoid `any`, unused variables, `var`, and unsafe TypeScript shortcuts.

Use descriptive kebab-case filenames such as `top-langs.ts` and match tests to the unit under test with `*.test.ts`. Prefer small, responsibility-focused modules over large mixed-purpose files.

## Testing Guidelines

Vitest is the test framework. Add or update tests for behavior changes, especially route handling, query parsing, caching, and SVG rendering. Keep tests in `tests/` and name them after the feature they cover. CI runs `typecheck`, `lint`, `format`, `test-run`, and `build`, so local changes should pass the same checks.

## Commit & Pull Request Guidelines

Recent history uses short prefix-style commits such as `add: test`, `fix: cache`, and `fix: README`. Keep commit messages concise and action-oriented.

PRs should explain the behavior change, note any configuration or secret changes, and include verification steps. Link relevant issues when applicable; include screenshots or sample SVG output when visual card rendering changes.

## Security & Configuration Tips

Do not commit secrets. Copy `.dev.vars.example` to `.dev.vars` for local development, set `GITHUB_USERNAME`, and provide GitHub tokens such as `PAT_1` through local vars or `wrangler secret put`.
