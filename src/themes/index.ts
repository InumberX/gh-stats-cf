export type Theme = {
  title_color: string
  icon_color: string
  text_color: string
  bg_color: string
  border_color: string
}

// Color values are derived from the original github-readme-stats themes
// (anuraghazra/github-readme-stats, MIT) and adapted for this project.
export const themes = {
  default: {
    title_color: '2f80ed',
    icon_color: '4c71f2',
    text_color: '434d58',
    bg_color: 'fffefe',
    border_color: 'e4e2e2',
  },
  dark: {
    title_color: 'fff',
    icon_color: '79ff97',
    text_color: '9f9f9f',
    bg_color: '151515',
    border_color: 'e4e2e2',
  },
  radical: {
    title_color: 'fe428e',
    icon_color: 'f8d847',
    text_color: 'a9fef7',
    bg_color: '141321',
    border_color: 'e4e2e2',
  },
  merko: {
    title_color: 'abd200',
    icon_color: 'b7d364',
    text_color: '68b3c8',
    bg_color: '0a0f0b',
    border_color: 'e4e2e2',
  },
  gruvbox: {
    title_color: 'fabd2f',
    icon_color: 'fe8019',
    text_color: '8ec07c',
    bg_color: '282828',
    border_color: 'e4e2e2',
  },
  tokyonight: {
    title_color: '70a5fd',
    icon_color: 'bf91f3',
    text_color: '38bdae',
    bg_color: '1a1b27',
    border_color: 'e4e2e2',
  },
} as const satisfies Record<string, Theme>

export type ThemeName = keyof typeof themes

export const isThemeName = (name: string): name is ThemeName => {
  // `in` would also match inherited keys (`toString`, `constructor`…); use own
  // property check so `?theme=toString` correctly falls back to default.
  return Object.hasOwn(themes, name)
}

export const resolveTheme = (name?: string | null): Theme => {
  // Trim so the cache-key normalizer (which trims) and this handler-side
  // resolver agree on inputs like `?theme=%20radical%20` — otherwise the
  // cache key collapses to `radical` while the handler renders `default`,
  // poisoning the cache for later valid requests.
  const trimmed = name?.trim()
  if (trimmed && isThemeName(trimmed)) return themes[trimmed]
  return themes.default
}

// CSS hex colors are exactly 3, 4, 6, or 8 hex digits. The leading `#` is
// stripped before testing, so the pattern itself must NOT also allow `#?` —
// otherwise inputs like `##fff` would pass and emit `##fff` downstream.
const hexPattern = /^(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

export const normalizeColor = (raw: string | undefined, fallback: string): string => {
  if (!raw) return fallback
  const trimmed = raw.trim().replace(/^#/, '')
  return hexPattern.test(trimmed) ? trimmed : fallback
}

export const buildTheme = (params: {
  theme?: string | null
  title_color?: string | null
  icon_color?: string | null
  text_color?: string | null
  bg_color?: string | null
  border_color?: string | null
}): Theme => {
  const base = resolveTheme(params.theme)
  return {
    title_color: normalizeColor(params.title_color ?? undefined, base.title_color),
    icon_color: normalizeColor(params.icon_color ?? undefined, base.icon_color),
    text_color: normalizeColor(params.text_color ?? undefined, base.text_color),
    bg_color: normalizeColor(params.bg_color ?? undefined, base.bg_color),
    border_color: normalizeColor(params.border_color ?? undefined, base.border_color),
  }
}
