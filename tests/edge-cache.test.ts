import { describe, expect, it } from 'vitest'

import { canonicalCacheKey } from '~/utils/edge-cache'

const STATS_KEYS: ReadonlySet<string> = new Set([
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
])

const TOP_LANGS_KEYS: ReadonlySet<string> = new Set([
  'theme',
  'title_color',
  'icon_color',
  'text_color',
  'bg_color',
  'border_color',
  'langs_count',
  'exclude_langs',
  'hide_border',
  'hide_title',
])

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
    // `langs_count` is only meaningful on top-langs. On the stats route it
    // must be stripped so it cannot fan out separate stats-card cache entries.
    const a = canonicalCacheKey('https://example.com/api?theme=radical&langs_count=1', STATS_KEYS)
    const b = canonicalCacheKey('https://example.com/api?theme=radical&langs_count=20', STATS_KEYS)
    const c = canonicalCacheKey('https://example.com/api?theme=radical', STATS_KEYS)
    expect(a).toBe(c)
    expect(b).toBe(c)
    // On the top-langs route, the same parameter remains cache-significant.
    const t1 = canonicalCacheKey('https://example.com/api/top-langs?theme=radical&langs_count=1', TOP_LANGS_KEYS)
    const t2 = canonicalCacheKey('https://example.com/api/top-langs?theme=radical&langs_count=20', TOP_LANGS_KEYS)
    expect(t1).not.toBe(t2)
  })

  it('collapses duplicate keys to the first value so ?theme=x&theme=y cannot fan out', () => {
    // The route handlers read each key once via c.req.query(key), so the
    // cache key must do the same — otherwise `?theme=radical&theme=nonce`
    // creates a distinct entry for the same rendered output.
    const a = canonicalCacheKey('https://example.com/api?theme=radical&theme=nonce', STATS_KEYS)
    const b = canonicalCacheKey('https://example.com/api?theme=radical', STATS_KEYS)
    expect(a).toBe(b)
  })
})
