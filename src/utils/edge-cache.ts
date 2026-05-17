import type { MiddlewareHandler } from 'hono'

import type { AppEnv } from '~/env'

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
  const cacheKey = c.req.url

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
