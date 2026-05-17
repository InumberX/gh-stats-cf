import type { MiddlewareHandler } from 'hono'

import type { AppEnv } from '~/env'

// Supported query parameters per route. Any other key in the request URL is
// dropped when building the cache key, so cache-busting params like
// `?nonce=...` cannot create distinct entries and bypass the edge cache.
//
// Keys are union-ed across all routes; the small per-route divergence is fine
// for cache identity because routes are also distinguished by pathname.
const SUPPORTED_QUERY_KEYS: ReadonlySet<string> = new Set([
  'theme',
  'title_color',
  'icon_color',
  'text_color',
  'bg_color',
  'border_color',
  'show_icons',
  'hide_rank',
  'hide_border',
  'hide_title',
  'langs_count',
  'exclude_langs',
])

// Build a stable cache key from the request URL: drop unknown query params,
// sort the rest alphabetically. Without this, callers can pass arbitrary
// extra query keys (e.g. `?nonce=...`) to bypass the edge cache and force
// repeated GitHub GraphQL calls.
export const canonicalCacheKey = (rawUrl: string): string => {
  const url = new URL(rawUrl)
  const keep: [string, string][] = []
  for (const [key, value] of url.searchParams.entries()) {
    if (SUPPORTED_QUERY_KEYS.has(key)) keep.push([key, value])
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
export const edgeCache = (): MiddlewareHandler<AppEnv> => async (c, next) => {
  if (c.req.method !== 'GET') {
    return next()
  }

  const cache = caches.default
  const cacheKey = canonicalCacheKey(c.req.url)

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
