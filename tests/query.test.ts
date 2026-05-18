import { describe, expect, it } from 'vitest'

import { isValidUsername, parseBoolParam, parseIntParam, parseListParam } from '~/utils/query'

describe('parseBoolParam', () => {
  it('returns fallback when undefined', () => {
    expect(parseBoolParam(undefined, true)).toBe(true)
    expect(parseBoolParam(undefined, false)).toBe(false)
  })
  it('parses truthy values', () => {
    expect(parseBoolParam('true', false)).toBe(true)
    expect(parseBoolParam('1', false)).toBe(true)
    expect(parseBoolParam('YES', false)).toBe(true)
  })
  it('parses falsy values', () => {
    expect(parseBoolParam('false', true)).toBe(false)
    expect(parseBoolParam('0', true)).toBe(false)
  })
  it('falls back on garbage', () => {
    expect(parseBoolParam('maybe', true)).toBe(true)
  })
  it('trims surrounding whitespace so encoded space inputs stay consistent with the cache key', () => {
    expect(parseBoolParam(' true ', false)).toBe(true)
    expect(parseBoolParam('\tfalse\n', true)).toBe(false)
    expect(parseBoolParam('  YES  ', false)).toBe(true)
  })
})

describe('parseIntParam', () => {
  it('parses valid integers', () => {
    expect(parseIntParam('42', 0)).toBe(42)
    expect(parseIntParam('-3', 0)).toBe(-3)
    expect(parseIntParam('  7 ', 0)).toBe(7)
  })
  it('falls back on garbage', () => {
    expect(parseIntParam('abc', 5)).toBe(5)
    expect(parseIntParam(undefined, 5)).toBe(5)
  })
  it('rejects partially-numeric strings', () => {
    expect(parseIntParam('10abc', 5)).toBe(5)
    expect(parseIntParam('1e3', 5)).toBe(5)
    expect(parseIntParam('3.14', 5)).toBe(5)
    expect(parseIntParam('', 5)).toBe(5)
  })
})

describe('parseListParam', () => {
  it('splits comma-separated values', () => {
    expect(parseListParam('a, b ,c')).toEqual(['a', 'b', 'c'])
  })
  it('returns empty array for undefined / empty', () => {
    expect(parseListParam(undefined)).toEqual([])
    expect(parseListParam('')).toEqual([])
  })
})

describe('isValidUsername', () => {
  it('accepts standard GitHub usernames', () => {
    expect(isValidUsername('InumberX')).toBe(true)
    expect(isValidUsername('octocat')).toBe(true)
    expect(isValidUsername('a-b-c')).toBe(true)
  })
  it('rejects invalid patterns', () => {
    expect(isValidUsername('')).toBe(false)
    expect(isValidUsername('-leading-dash')).toBe(false)
    expect(isValidUsername('trailing-dash-')).toBe(false)
    expect(isValidUsername('double--dash')).toBe(false)
    expect(isValidUsername('has space')).toBe(false)
    expect(isValidUsername('a'.repeat(40))).toBe(false)
  })
})
