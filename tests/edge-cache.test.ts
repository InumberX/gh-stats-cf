import { describe, expect, it } from 'vitest'

import { canonicalCacheKey } from '~/utils/edge-cache'

describe('canonicalCacheKey', () => {
  it('keeps an URL with no query untouched', () => {
    expect(canonicalCacheKey('https://example.com/api')).toBe('https://example.com/api')
  })

  it('drops unknown query parameters so cache-busting nonces collapse to the same key', () => {
    const a = canonicalCacheKey('https://example.com/api?theme=radical&nonce=1')
    const b = canonicalCacheKey('https://example.com/api?theme=radical&nonce=2')
    const c = canonicalCacheKey('https://example.com/api?theme=radical')
    expect(a).toBe(c)
    expect(b).toBe(c)
  })

  it('sorts supported query keys for stable identity', () => {
    const a = canonicalCacheKey('https://example.com/api?theme=radical&hide_rank=true')
    const b = canonicalCacheKey('https://example.com/api?hide_rank=true&theme=radical')
    expect(a).toBe(b)
    expect(a).toContain('hide_rank=true')
    expect(a).toContain('theme=radical')
  })

  it('preserves the pathname (route still distinguishes /api from /api/top-langs)', () => {
    const stats = canonicalCacheKey('https://example.com/api?theme=radical')
    const top = canonicalCacheKey('https://example.com/api/top-langs?theme=radical')
    expect(stats).not.toBe(top)
  })
})
