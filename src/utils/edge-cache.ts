import type { MiddlewareHandler } from 'hono'

import type { AppEnv } from '~/env'
import { isThemeName } from '~/themes'

// Per-key normalizer used by `canonicalCacheKey`. Should return the canonical
// effective form of `raw`, or `undefined` if the value is invalid (in which
// case the key is dropped from the cache key entirely — matching the way
// route handlers silently fall back to defaults on invalid input).
export type Normalizer = (raw: string) => string | undefined

const TRUE_WORDS = new Set(['true', '1', 'yes'])
const FALSE_WORDS = new Set(['false', '0', 'no'])

const boolNormalize: Normalizer = (raw) => {
  const v = raw.toLowerCase().trim()
  if (TRUE_WORDS.has(v)) return 'true'
  if (FALSE_WORDS.has(v)) return 'false'
  return undefined
}

const HEX_PATTERN = /^(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/

const hexNormalize: Normalizer = (raw) => {
  const trimmed = raw.trim().replace(/^#/, '').toLowerCase()
  return HEX_PATTERN.test(trimmed) ? trimmed : undefined
}

const themeNormalize: Normalizer = (raw) => {
  const v = raw.trim()
  return isThemeName(v) ? v : undefined
}

const INT_PATTERN = /^-?\d+$/

const intNormalize =
  (min: number, max: number): Normalizer =>
  (raw) => {
    const trimmed = raw.trim()
    if (!INT_PATTERN.test(trimmed)) return undefined
    const n = Math.min(max, Math.max(min, Number.parseInt(trimmed, 10)))
    return String(n)
  }

const csvNormalize: Normalizer = (raw) => {
  const items = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  if (items.length === 0) return undefined
  return [...new Set(items)].sort().join(',')
}

// Public normalizers grouped by domain so route configs read declaratively.
export const cacheNormalizers = {
  bool: boolNormalize,
  hex: hexNormalize,
  theme: themeNormalize,
  int: intNormalize,
  csv: csvNormalize,
}

export type EdgeCacheOptions = {
  // Query parameters the matched route actually reads, each mapped to a
  // normalizer that produces the *effective* value used by the handler.
  // Unknown keys are dropped, invalid values are dropped to their fallback,
  // and equivalent inputs collapse to one cache entry.
  allowedQueryKeys: Readonly<Record<string, Normalizer>>
}

// Build a stable cache key from the request URL:
//   1. Drop any query parameter not in `allowed` (per-route allow-list).
//   2. Collapse duplicate keys to the first value — `c.req.query()` reads
//      only the first value, so duplicates must not be cache-significant.
//   3. Normalize the value via the per-key normalizer; if it returns
//      `undefined`, drop the key (matches handler fallback behavior).
//   4. Sort the remaining keys alphabetically for stable identity.
//
// Without this, callers can attach arbitrary, duplicated, or equivalent
// query keys (e.g. `?nonce=...`, `?theme=radical&theme=x`, `?title_color=fff`
// vs `?title_color=%23FFF`) to fan out separate edge-cache entries for the
// same rendered SVG, forcing repeated GitHub GraphQL calls.
export const canonicalCacheKey = (rawUrl: string, allowed: Readonly<Record<string, Normalizer>>): string => {
  const url = new URL(rawUrl)
  const keep: [string, string][] = []
  const seen = new Set<string>()
  for (const key of url.searchParams.keys()) {
    if (seen.has(key)) continue
    const norm = allowed[key]
    if (!norm) continue
    seen.add(key)
    const raw = url.searchParams.get(key)
    if (raw === null) continue
    const value = norm(raw)
    if (value !== undefined) keep.push([key, value])
  }
  keep.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  url.search = new URLSearchParams(keep).toString()
  return url.toString()
}

// Caches successful GET responses at the Cloudflare edge using the Workers
// Cache API (caches.default). Cache lifetime is governed by the
// `Cache-Control` header set by the downstream handler.
//
// Adds a `CF-Cache-Status: HIT | MISS` header for observability.
export const edgeCache =
  (options: EdgeCacheOptions): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    if (c.req.method !== 'GET') {
      return next()
    }

    const cache = caches.default
    const cacheKey = canonicalCacheKey(c.req.url, options.allowedQueryKeys)

    const cached = await cache.match(cacheKey)
    if (cached) {
      const headers = new Headers(cached.headers)
      headers.set('CF-Cache-Status', 'HIT')
      return new Response(cached.body, {
        status: cached.status,
        headers,
      })
    }

    await next()

    if (c.res.status === 200) {
      const cacheable = c.res.clone()
      c.executionCtx.waitUntil(cache.put(cacheKey, cacheable))
    }
    c.res.headers.set('CF-Cache-Status', 'MISS')
  }
