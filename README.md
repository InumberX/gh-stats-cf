# gh-stats-cf

Self-hostable GitHub readme stats cards on **Cloudflare Workers**, written in TypeScript with [Hono](https://hono.dev/).

Heavily inspired by [`anuraghazra/github-readme-stats`](https://github.com/anuraghazra/github-readme-stats) — this project re-implements a minimal subset of its API on the Cloudflare edge so you can self-host it for free in a few minutes.

## Features

- ⚡ Runs on the Cloudflare Workers free plan
- 🎨 Six built-in themes: `default`, `dark`, `radical`, `merko`, `gruvbox`, `tokyonight`
- 🖼️ Two endpoints: `/api` (stats card) and `/api/top-langs`
- 🔒 Optional `WHITELIST` to restrict your instance to specific usernames
- 🔁 Multi-PAT rotation (`PAT_1` … `PAT_5`)
- 🧪 Vitest test suite
- 📦 Zero runtime dependencies besides Hono

## Quick start

### 1. Fork this repo

[Fork on GitHub](https://github.com/InumberX/gh-stats-cf/fork) and clone your fork locally.

### 2. Create a GitHub Personal Access Token

A PAT is required for two reasons: it lifts the GitHub API rate limit from 60/h to 5000/h per token, and it lets you see your **own private contribution count** when `count_private=true`.

Recommended: a [fine-grained PAT](https://github.com/settings/personal-access-tokens/new) with these permissions:

- **Repository access**: All repositories
- **Permissions**:
  - Repository → **Contents: Read**
  - Repository → **Metadata: Read** (auto)

### 3. Install and configure

```bash
npm install
cp .dev.vars.example .dev.vars
# then edit .dev.vars and set PAT_1=ghp_xxx
```

Edit `wrangler.jsonc` and change `name` to your own Worker name (e.g. `gh-stats-yourname`).

### 4. Run locally

```bash
npm run dev
# open http://localhost:8787/api?username=octocat&theme=radical
```

### 5. Deploy

```bash
npx wrangler login
npx wrangler secret put PAT_1
# paste your token

npm run deploy
```

Your cards will be available at `https://<worker-name>.<your-subdomain>.workers.dev/api?username=...`.

## API

### `GET /api` — stats card

| Param            | Type    | Default   | Description |
| ---------------- | ------- | --------- | --- |
| `username`       | string  | (required)| GitHub login |
| `theme`          | string  | `default` | One of: `default`, `dark`, `radical`, `merko`, `gruvbox`, `tokyonight` |
| `count_private`  | bool    | `false`   | Include your private contribution count (requires your own PAT) |
| `show_icons`     | bool    | `false`   | Show row icons |
| `hide_rank`      | bool    | `false`   | Hide the rank circle |
| `hide_border`    | bool    | `false`   | Hide the card border |
| `hide_title`     | bool    | `false`   | Hide the header title |
| `title_color`    | hex     | theme     | Override title color (no `#`) |
| `icon_color`     | hex     | theme     | Override icon color |
| `text_color`     | hex     | theme     | Override body text color |
| `bg_color`       | hex     | theme     | Override background color |
| `border_color`   | hex     | theme     | Override border color |

### `GET /api/top-langs` — most-used languages card

| Param           | Type   | Default | Description |
| --------------- | ------ | ------- | --- |
| `username`      | string | (req)   | GitHub login |
| `theme`         | string | `default` | Same set as above |
| `langs_count`   | int    | `5`     | Number of languages to show |
| `exclude_langs` | csv    | (none)  | Comma-separated language names to exclude |
| `hide_border`   | bool   | `false` | Hide the card border |
| `hide_title`    | bool   | `false` | Hide the header title |

Color overrides (`title_color`, `text_color`, `bg_color`, `border_color`) work here too.

## Caching

Successful SVG responses are cached at two layers:

1. **Workers Cache API** (`caches.default`) — edge cache, deduplicates concurrent requests and dramatically reduces GitHub API calls. Cache lifetime follows the `Cache-Control` header.
2. **`Cache-Control` header** — `public, max-age=${CACHE_SECONDS}, s-maxage=…, stale-while-revalidate=…`. This is also respected by GitHub's `camo` image proxy, which is the biggest win in practice (READMEs are served through camo).

Error responses are cached for 60 seconds.

You can verify cache behavior via the `CF-Cache-Status` response header (`HIT` or `MISS`).

## Environment variables

Set via `wrangler secret put` (recommended for tokens) or in `wrangler.jsonc` `vars` block:

| Name              | Type   | Default | Notes |
| ----------------- | ------ | ------- | --- |
| `PAT_1`           | secret | —       | **Required.** GitHub PAT. |
| `PAT_2` … `PAT_5` | secret | —       | Optional rotation slots. |
| `CACHE_SECONDS`   | var    | `86400` | SVG `Cache-Control` max-age (default: 1 day). |
| `WHITELIST`       | var    | —       | Comma-separated GitHub logins allowed to query this instance. Empty means anyone. |

## Themes

```
default      dark         radical
merko        gruvbox      tokyonight
```

To preview against your data, just swap the URL:

```
https://<your-worker>/api?username=octocat&theme=tokyonight
```

## Development

```bash
npm run dev         # Start wrangler dev (http://localhost:8787)
npm run typecheck   # TypeScript noEmit
npm run test        # Vitest watch mode
npm run test-run    # Vitest one-shot
npm run lint        # oxlint
npm run lint-fix    # oxlint --fix
npm run format      # oxfmt --check
npm run format-fix  # oxfmt write
npm run pre-commit  # typecheck + lint-fix + format-fix
npm run upgrade-check # Show outdated packages
npm run upgrade     # Bump versions in package.json (run npm install afterwards)
npm run build       # Wrangler dry-run build
npm run deploy      # Deploy to Cloudflare
```

Lint/format use [oxlint](https://oxc.rs/docs/guide/usage/linter.html) and [oxfmt](https://oxc.rs/) (Rust-based, faster than ESLint/Prettier). Configs: `.oxlintrc.json`, `.oxfmtrc.json`.

## License

MIT. See [LICENSE](./LICENSE).

This project is inspired by [`anuraghazra/github-readme-stats`](https://github.com/anuraghazra/github-readme-stats) (MIT). Theme color values are derived from the original project; full credit to its authors.
