# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # wrangler dev on http://localhost:8787
npm run typecheck    # wrangler types + tsc --noEmit
npm run test         # vitest watch
npm run test-run     # vitest one-shot
npm run lint         # oxlint --max-warnings=0 on src/ and tests/
npm run lint-fix     # oxlint --fix
npm run format       # oxfmt --check
npm run format-fix   # oxfmt write
npm run pre-commit   # typecheck + lint-fix + format-fix (run before commit)
npm run build        # wrangler deploy --dry-run --outdir=dist
npm run deploy       # wrangler deploy
```

Run a single test file: `npx vitest run tests/edge-cache.test.ts`. Filter by name: `npx vitest run -t "wraps long messages"`.

`npm run typecheck` regenerates `worker-configuration.d.ts` from `wrangler.jsonc` via `wrangler types` first. That file is gitignored; on a fresh checkout, run `typecheck` (or `npm run cf-typegen`) before touching the TS types.

Local dev requires `.dev.vars` (copy `.dev.vars.example`) with at least `GITHUB_USERNAME=<your-login>` and `PAT_1=<token>` — without them the worker renders an error SVG instead of starting up. Node >=22.12 is required (oxlint/oxfmt depend on it).

Lint/format are **oxc-based** (Rust): `oxlint`/`oxfmt`, not ESLint/Prettier. Configs live in `.oxlintrc.json` / `.oxfmtrc.json`. `~/*` paths in source map to `src/*` (see `tsconfig.json` and `vitest.config.ts` — vitest uses `fileURLToPath` for Windows portability).

## Architecture

Cloudflare Worker (Hono + TypeScript). Entry point is `src/index.ts`, which mounts two sub-apps:

```
GET /api            → src/routes/stats.ts        (stats card SVG)
GET /api/top-langs  → src/routes/top-langs.ts    (most-used languages SVG)
```

Each request flows: **route handler → fetcher → GraphQL → card renderer → SVG response**, wrapped by an edge-cache middleware that runs before/after the handler.

### Layers

- `src/routes/*.ts` — Hono handlers. Parse query params with `~/utils/query`, build a theme via `~/themes`, call the fetcher, then the renderer. Return an `svg+xml` response with `Cache-Control` set from `CACHE_SECONDS`. Each route also exports its `*_CACHE_OPTIONS` object so tests can pin on the production cache config.
- `src/fetchers/*.ts` — GraphQL aggregation. `github.ts` is a thin client with multi-PAT rotation; `stats.ts` / `top-langs.ts` define the GraphQL queries and aggregate paginated repository data.
- `src/cards/*.ts` — Pure SVG renderers. No I/O. Take a typed model + `Theme` + options and return an SVG string. Includes `error.ts`, `stats.ts`, `top-langs.ts`, plus `icons.ts`.
- `src/themes/index.ts` — Six built-in themes plus `buildTheme()` / `resolveTheme()` / `normalizeColor()` helpers. `isThemeName` uses `Object.hasOwn` (not `in`) to reject inherited prototype keys.
- `src/utils/edge-cache.ts` — Workers Cache API middleware + `canonicalCacheKey()`. The cache key is built from a per-route allow-list of query parameters, each normalized to the same canonical form the handler uses.
- `src/env.ts` — `AppEnv` Bindings type plus `collectPats`, `getOwnerUsername`, `cacheTtlSeconds` helpers.

### Single-user model

This worker serves **exactly one GitHub account**, set via the `GITHUB_USERNAME` env var. There is **no `?username=` query parameter** — the routes ignore caller-supplied usernames entirely. This is structural, not advisory: removing this constraint would re-introduce a class of cache / privacy issues (anyone could request `?username=<PAT owner>&count_private=true` etc.). All configured `PAT_1`…`PAT_5` should belong to the same GitHub user (ideally `GITHUB_USERNAME` itself); mixing accounts makes the viewer-dependent `contributionsCollection.totalCommitContributions` flip between public-only and private-inclusive values across cache fills.

### Edge cache invariants

`src/utils/edge-cache.ts` implements a Cloudflare Cache API middleware. The cache key is **not** the raw request URL — it goes through `canonicalCacheKey(rawUrl, options)`, which:

1. Drops query keys not in `allowedQueryKeys` (so `?nonce=...` cannot fragment the cache).
2. Collapses duplicate keys (`?theme=x&theme=y`) to the first value (matches Hono's `c.req.query()`).
3. Normalizes each value to the **effective** form the handler would use (`cacheNormalizers.bool`/`hex`/`theme`/`int`/`csv`). Invalid values are dropped to fallback parity with handler-side parsing.
4. Applies an optional `finalize` step to drop keys that are conditionally ignored (e.g. `border_color` when `hide_border=true`, `icon_color` when `show_icons!=true`).
5. Sorts keys alphabetically.

When adding or renaming a query parameter, update **three** places together or the cache will silently fragment:
- The handler's `c.req.query(...)` and parser
- The route's exported `*_QUERY_KEYS` allow-list (with the matching normalizer)
- The route's `finalize` if the key is conditionally ignored

The middleware is registered with `route.use('/', edgeCache(...))` — **NOT** `use('*', ...)`. Mounting a sub-app with `use('*', ...)` makes its middleware run for any nested path, so the stats middleware would also fire for `/api/top-langs` and cache its responses under the stats allow-list (dropping `langs_count` / `exclude_langs` and serving wrong SVGs).

### GitHub client + error classification

`src/fetchers/github.ts` rotates through the configured PATs and classifies errors into `GitHubErrorKind`:

- HTTP 401 → `UNAUTHORIZED`, rotate
- HTTP 403 → check `x-ratelimit-remaining`, `retry-after`, body for `rate limit` / `abuse` wording → `RATE_LIMITED` (else `UNAUTHORIZED`), rotate
- HTTP 429 → `RATE_LIMITED`, rotate
- GraphQL `errors[].type === 'NOT_FOUND'` → throw immediately (no rotation)
- GraphQL `errors[].type === 'RATE_LIMITED'` → rotate
- GraphQL `FORBIDDEN`/`UNAUTHORIZED` or auth-style messages → rotate (single mis-scoped PAT should not poison the whole request)
- Other GraphQL errors → `GRAPHQL_ERROR`, no rotation

If you change this classification, also update `tests/github.test.ts` — it covers each branch with mocked `fetch`.

### Data scoping

- All stargazer / language aggregation uses `privacy: PUBLIC` + `isFork: false` so private and forked repos never leak.
- PR / issue / review counts use the GraphQL `search` type with `is:public` filters built from the validated `GITHUB_USERNAME`.
- `contributionsCollection.totalCommitContributions` is the **one exception**: GitHub has no public-only commit count, and for the PAT owner it includes private commits. This is documented in the README; do not try to "fix" by adding a search-API path unless you also reconcile the cache implications (see `count_private` history in the PR — that parameter was removed for this reason).
- Repository pagination is capped at `MAX_REPO_PAGES = 100` (= 10,000 repos) in both fetchers. Beyond that, `console.warn` is emitted and aggregation is partial.

### Card rendering constraints

SVG cards are consumed as `<img>` sources (often through GitHub's `camo` proxy), so renderers do not use `<foreignObject>` or external resources. User-visible text is **truncated server-side** rather than relying on CSS clipping:

- Stats title: name truncated to 24 chars (visible `<text>`), full name kept in `<title>` for accessibility.
- Top-langs row labels: language name truncated to 12 chars; full name kept in `<desc>`.
- Top-langs bar segments: never set `rx` on individual `<rect>` — the enclosing `bar-mask` rounds the outer edges, per-segment rounding creates gaps where adjacent colors meet.
- Top-langs percentages are computed against the **full** language total (after `excludeLangs`), then truncated to `langs_count` rows in the renderer. Don't move the slice into the fetcher — that re-normalizes percentages to sum to 100% which misrepresents top-N as 100% coverage.
- Error card wraps messages via `wrapMessage` (cursor-based; do not regress to `lines.join(' ').length` — that loses overflow detection for unbroken long strings) and grows the card height dynamically.

All renderers escape user-controlled strings via `~/utils/svg.escapeXml`. `escapeXml` is centralized; do not introduce new ad-hoc escape helpers.

## Tests

Vitest with `environment: 'node'`. Tests live in `tests/` and follow the source layout:

- `tests/edge-cache.test.ts` imports the production `STATS_CACHE_OPTIONS` / `TOP_LANGS_CACHE_OPTIONS` directly (not redefined fixtures) so route-config drift surfaces as test failures.
- `tests/github.test.ts` and `tests/stats.test.ts` / `tests/top-langs.test.ts` mock `fetch` via `vi.stubGlobal('fetch', vi.fn())`. Use `mockImplementation` rather than `mockResolvedValue` when a `Response` is consumed in a rotation loop — `Response` bodies are streams and can only be read once.
- `tests/stats-rank.test.ts` exercises `__test.calculateRank` exported from `src/fetchers/stats.ts`.
