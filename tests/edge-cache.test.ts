import { describe, expect, it } from 'vitest'

import { cacheNormalizers, canonicalCacheKey } from '~/utils/edge-cache'

const STATS_KEYS = {
  theme: cacheNormalizers.theme,
  title_color: cacheNormalizers.hex,
  icon_color: cacheNormalizers.hex,
  text_color: cacheNormalizers.hex,
  bg_color: cacheNormalizers.hex,
  border_color: cacheNormalizers.hex,
  show_icons: cacheNormalizers.bool,
  hide_rank: cacheNormalizers.bool,
  hide_border: cacheNormalizers.bool,
  hide_title: cacheNormalizers.bool,
} as const

const TOP_LANGS_KEYS = {
  theme: cacheNormalizers.theme,
  title_color: cacheNormalizers.hex,
  text_color: cacheNormalizers.hex,
  bg_color: cacheNormalizers.hex,
  border_color: cacheNormalizers.hex,
  langs_count: cacheNormalizers.int(1, 20),
  exclude_langs: cacheNormalizers.csv,
  hide_border: cacheNormalizers.bool,
  hide_title: cacheNormalizers.bool,
} as const

describe('canonicalCacheKey', () => {
  it('keeps an URL with no query untouched', () => {
    expect(canonicalCacheKey('https://example.com/api', STATS_KEYS)).toBe('https://example.com/api')
  })

  it('drops unknown query parameters so cache-busting nonces collapse to the same key', () => {
    const a = canonicalCacheKey('https://example.com/api?theme=radical&nonce=1', STATS_KEYS)
    const b = canonicalCacheKey('https://example.com/api?theme=radical&nonce=2', STATS_KEYS)
    const c = canonicalCacheKey('https://example.com/api?theme=radical', STATS_KEYS)
    expect(a).toBe(c)
    expect(b).toBe(c)
  })

  it('sorts supported query keys for stable identity', () => {
    const a = canonicalCacheKey('https://example.com/api?theme=radical&hide_rank=true', STATS_KEYS)
    const b = canonicalCacheKey('https://example.com/api?hide_rank=true&theme=radical', STATS_KEYS)
    expect(a).toBe(b)
    expect(a).toContain('hide_rank=true')
    expect(a).toContain('theme=radical')
  })

  it('preserves the pathname (route still distinguishes /api from /api/top-langs)', () => {
    const stats = canonicalCacheKey('https://example.com/api?theme=radical', STATS_KEYS)
    const top = canonicalCacheKey('https://example.com/api/top-langs?theme=radical', TOP_LANGS_KEYS)
    expect(stats).not.toBe(top)
  })

  it('drops parameters that exist in another route but not the matched one', () => {
    const a = canonicalCacheKey('https://example.com/api?theme=radical&langs_count=1', STATS_KEYS)
    const b = canonicalCacheKey('https://example.com/api?theme=radical&langs_count=20', STATS_KEYS)
    const c = canonicalCacheKey('https://example.com/api?theme=radical', STATS_KEYS)
    expect(a).toBe(c)
    expect(b).toBe(c)
    const t1 = canonicalCacheKey('https://example.com/api/top-langs?theme=radical&langs_count=1', TOP_LANGS_KEYS)
    const t2 = canonicalCacheKey('https://example.com/api/top-langs?theme=radical&langs_count=20', TOP_LANGS_KEYS)
    expect(t1).not.toBe(t2)
  })

  it('drops icon_color on the top-langs route (the renderer ignores it)', () => {
    const a = canonicalCacheKey('https://example.com/api/top-langs?theme=radical&icon_color=ff0000', TOP_LANGS_KEYS)
    const b = canonicalCacheKey('https://example.com/api/top-langs?theme=radical', TOP_LANGS_KEYS)
    expect(a).toBe(b)
  })

  it('collapses duplicate keys to the first value so ?theme=x&theme=y cannot fan out', () => {
    const a = canonicalCacheKey('https://example.com/api?theme=radical&theme=nonce', STATS_KEYS)
    const b = canonicalCacheKey('https://example.com/api?theme=radical', STATS_KEYS)
    expect(a).toBe(b)
  })

  it('drops invalid theme values so ?theme=nonexistent collapses to the default', () => {
    const a = canonicalCacheKey('https://example.com/api?theme=nonexistent', STATS_KEYS)
    const b = canonicalCacheKey('https://example.com/api', STATS_KEYS)
    expect(a).toBe(b)
  })

  it('normalizes boolean equivalents (true / 1 / yes) to a single canonical token', () => {
    const a = canonicalCacheKey('https://example.com/api?show_icons=true', STATS_KEYS)
    const b = canonicalCacheKey('https://example.com/api?show_icons=1', STATS_KEYS)
    const c = canonicalCacheKey('https://example.com/api?show_icons=YES', STATS_KEYS)
    expect(a).toBe(b)
    expect(a).toBe(c)
  })

  it('normalizes hex color variants (case + optional `#` + URL-encoded `#`) to one key', () => {
    const a = canonicalCacheKey('https://example.com/api?title_color=FFF', STATS_KEYS)
    const b = canonicalCacheKey('https://example.com/api?title_color=fff', STATS_KEYS)
    const c = canonicalCacheKey('https://example.com/api?title_color=%23fff', STATS_KEYS)
    expect(a).toBe(b)
    expect(a).toBe(c)
  })

  it('drops invalid hex colors so ?title_color=zzz collapses to the default', () => {
    const a = canonicalCacheKey('https://example.com/api?title_color=zzz', STATS_KEYS)
    const b = canonicalCacheKey('https://example.com/api', STATS_KEYS)
    expect(a).toBe(b)
  })

  it('clamps langs_count to the documented [1, 20] range', () => {
    const high = canonicalCacheKey('https://example.com/api/top-langs?langs_count=999', TOP_LANGS_KEYS)
    const cap = canonicalCacheKey('https://example.com/api/top-langs?langs_count=20', TOP_LANGS_KEYS)
    expect(high).toBe(cap)
    const low = canonicalCacheKey('https://example.com/api/top-langs?langs_count=0', TOP_LANGS_KEYS)
    const min = canonicalCacheKey('https://example.com/api/top-langs?langs_count=1', TOP_LANGS_KEYS)
    expect(low).toBe(min)
  })

  it('drops langs_count when the digit string is so long parseInt overflows to Infinity', () => {
    // parseIntParam (handler side) drops non-finite results to its fallback,
    // so this cache key must do the same — otherwise the oversized request
    // would be cached under `langs_count=20` and later served for a real
    // `?langs_count=20` request despite being rendered with the default (5).
    const huge = '9'.repeat(400)
    const overflow = canonicalCacheKey(`https://example.com/api/top-langs?langs_count=${huge}`, TOP_LANGS_KEYS)
    const omitted = canonicalCacheKey('https://example.com/api/top-langs', TOP_LANGS_KEYS)
    expect(overflow).toBe(omitted)
  })

  it('does not allow whitespace-padded values to poison the cache (bool)', () => {
    // `?show_icons=%20true%20` must collapse to the same cache key as
    // `?show_icons=true`, AND the handler-side parseBoolParam must agree
    // (both trim). Otherwise a padded request can be cached and later
    // served for clean requests with a different effective value.
    const padded = canonicalCacheKey('https://example.com/api?show_icons=%20true%20', STATS_KEYS)
    const clean = canonicalCacheKey('https://example.com/api?show_icons=true', STATS_KEYS)
    expect(padded).toBe(clean)
  })

  it('does not allow whitespace-padded values to poison the cache (theme)', () => {
    const padded = canonicalCacheKey('https://example.com/api?theme=%20radical%20', STATS_KEYS)
    const clean = canonicalCacheKey('https://example.com/api?theme=radical', STATS_KEYS)
    expect(padded).toBe(clean)
  })

  it('canonicalizes exclude_langs (case + ordering + duplicates)', () => {
    const a = canonicalCacheKey('https://example.com/api/top-langs?exclude_langs=Go,Rust', TOP_LANGS_KEYS)
    const b = canonicalCacheKey('https://example.com/api/top-langs?exclude_langs=rust,go', TOP_LANGS_KEYS)
    const c = canonicalCacheKey('https://example.com/api/top-langs?exclude_langs=go,rust,go', TOP_LANGS_KEYS)
    expect(a).toBe(b)
    expect(a).toBe(c)
  })
})
