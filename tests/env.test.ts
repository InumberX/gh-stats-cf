import { describe, expect, it } from 'vitest'

import { cacheTtlSeconds, collectPats, getOwnerUsername } from '~/env'

describe('collectPats', () => {
  it('collects defined PATs in order', () => {
    expect(collectPats({ PAT_1: 'a', PAT_3: 'c' })).toEqual(['a', 'c'])
  })
  it('returns empty when none set', () => {
    expect(collectPats({})).toEqual([])
  })
})

describe('getOwnerUsername', () => {
  it('returns the trimmed username when valid', () => {
    expect(getOwnerUsername({ GITHUB_USERNAME: '  InumberX ' })).toBe('InumberX')
  })
  it('returns null when unset or empty', () => {
    expect(getOwnerUsername({})).toBeNull()
    expect(getOwnerUsername({ GITHUB_USERNAME: '' })).toBeNull()
    expect(getOwnerUsername({ GITHUB_USERNAME: '   ' })).toBeNull()
  })
  it('returns null when the username fails GitHub login rules', () => {
    expect(getOwnerUsername({ GITHUB_USERNAME: '-bad' })).toBeNull()
    expect(getOwnerUsername({ GITHUB_USERNAME: 'has space' })).toBeNull()
  })
})

describe('cacheTtlSeconds', () => {
  it('defaults to 86400 (1 day)', () => {
    expect(cacheTtlSeconds({})).toBe(86400)
  })
  it('parses positive integers', () => {
    expect(cacheTtlSeconds({ CACHE_SECONDS: '60' })).toBe(60)
  })
  it('falls back on garbage', () => {
    expect(cacheTtlSeconds({ CACHE_SECONDS: 'abc' })).toBe(86400)
    expect(cacheTtlSeconds({ CACHE_SECONDS: '-5' })).toBe(86400)
  })
})
