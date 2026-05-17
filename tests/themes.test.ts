import { describe, expect, it } from 'vitest'

import { buildTheme, isThemeName, normalizeColor, resolveTheme, themes } from '~/themes'

describe('themes', () => {
  it('exposes the 6 documented themes', () => {
    expect(Object.keys(themes).sort()).toEqual(['dark', 'default', 'gruvbox', 'merko', 'radical', 'tokyonight'].sort())
  })

  it('isThemeName narrows correctly', () => {
    expect(isThemeName('radical')).toBe(true)
    expect(isThemeName('not-a-theme')).toBe(false)
  })

  it('isThemeName rejects inherited Object.prototype properties', () => {
    expect(isThemeName('toString')).toBe(false)
    expect(isThemeName('constructor')).toBe(false)
    expect(isThemeName('hasOwnProperty')).toBe(false)
  })

  it('resolveTheme falls back to default for unknown name', () => {
    expect(resolveTheme('unknown')).toEqual(themes.default)
    expect(resolveTheme(undefined)).toEqual(themes.default)
    expect(resolveTheme(null)).toEqual(themes.default)
    expect(resolveTheme('radical')).toEqual(themes.radical)
  })

  it('normalizeColor accepts only valid 3/4/6/8-digit hex and falls back otherwise', () => {
    expect(normalizeColor('#FF0000', '000')).toBe('FF0000')
    expect(normalizeColor('aabbcc', '000')).toBe('aabbcc')
    expect(normalizeColor('abcd', '000')).toBe('abcd')
    expect(normalizeColor('aabbccdd', '000')).toBe('aabbccdd')
    expect(normalizeColor('not-a-color', '000')).toBe('000')
    expect(normalizeColor(undefined, 'abc')).toBe('abc')
    // 5- and 7-digit hex are invalid in CSS — must fall back.
    expect(normalizeColor('12345', '000')).toBe('000')
    expect(normalizeColor('1234567', '000')).toBe('000')
    // Double leading `#` must NOT slip through the strip-then-test step.
    expect(normalizeColor('##fff', '000')).toBe('000')
  })

  it('buildTheme merges per-color overrides on top of base theme', () => {
    const t = buildTheme({ theme: 'radical', title_color: '00ff00' })
    expect(t.title_color).toBe('00ff00')
    expect(t.bg_color).toBe(themes.radical.bg_color)
  })
})
