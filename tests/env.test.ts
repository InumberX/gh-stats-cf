import { describe, expect, it } from 'vitest'

import { cacheTtlSeconds, collectPats, isAllowedUser } from '~/env'

describe('collectPats', () => {
  it('collects defined PATs in order', () => {
    expect(collectPats({ PAT_1: 'a', PAT_3: 'c' })).toEqual(['a', 'c'])
  })
  it('returns empty when none set', () => {
    expect(collectPats({})).toEqual([])
  })
})

describe('isAllowedUser', () => {
  it('allows everyone when WHITELIST is unset', () => {
    expect(isAllowedUser({}, 'anyone')).toBe(true)
  })
  it('matches case-insensitively', () => {
    expect(isAllowedUser({ WHITELIST: 'InumberX, octocat' }, 'inumberx')).toBe(true)
  })
  it('rejects users not in WHITELIST', () => {
    expect(isAllowedUser({ WHITELIST: 'inumberx' }, 'other')).toBe(false)
  })
})

describe('cacheTtlSeconds', () => {
  it('defaults to 1800', () => {
    expect(cacheTtlSeconds({})).toBe(1800)
  })
  it('parses positive integers', () => {
    expect(cacheTtlSeconds({ CACHE_SECONDS: '60' })).toBe(60)
  })
  it('falls back on garbage', () => {
    expect(cacheTtlSeconds({ CACHE_SECONDS: 'abc' })).toBe(1800)
    expect(cacheTtlSeconds({ CACHE_SECONDS: '-5' })).toBe(1800)
  })
})
