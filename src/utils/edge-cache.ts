import type { MiddlewareHandler } from 'hono'

import type { AppEnv } from '~/env'

export type EdgeCacheOptions = {
  // Query parameters the matched route actually reads. Anything outside this
  // set is dropped from the cache key so a caller cannot bypass the edge
  // cache via cache-busting / route-irrelevant params.
  allowedQueryKeys: ReadonlySet<string>
}

// Build a stable cache key from the request URL:
//   1. Drop any query parameter not in `allowed` (per-route allow-list).
//   2. Collapse duplicate keys to the first value — `c.req.query()` reads
//      only the first value, so duplicates must not be cache-significant.
//   3. Sort the remaining keys alphabetically for stable identity.
//
// Without this, a caller can attach arbitrary or duplicated query keys (for
// example `?nonce=...` or `?theme=radical&theme=x`) to fan out separate
// edge-cache entries and force repeated GitHub GraphQL calls.
export const canonicalCacheKey = (rawUrl: string, allowed: ReadonlySet<string>): string => {
  const url = new URL(rawUrl)
  const keep: [string, string][] = []
  const seen = new Set<string>()
  for (const key of url.searchParams.keys()) {
    if (seen.has(key)) continue
    if (!allowed.has(key)) continue
    seen.add(key)
    const value = url.searchParams.get(key)
    if (value !== null) keep.push([key, value])
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
