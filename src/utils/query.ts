export const parseBoolParam = (raw: string | undefined, fallback: boolean): boolean => {
  if (raw === undefined) return fallback
  // Trim so the cache-key normalizer (which trims) and this handler-side
  // parser agree on inputs like `?show_icons=%20true%20` — otherwise the
  // cache key collapses to `true` while the handler renders the fallback,
  // poisoning the cache for later valid requests.
  const v = raw.trim().toLowerCase()
  if (v === 'true' || v === '1' || v === 'yes') return true
  if (v === 'false' || v === '0' || v === 'no') return false
  return fallback
}

// Strict: the entire string must be a base-10 integer. `Number.parseInt`
// alone accepts "10abc"/"1e3" and silently truncates them; reject those so
// query params behave as a documented `int` type.
const INTEGER_PATTERN = /^-?\d+$/

export const parseIntParam = (raw: string | undefined, fallback: number): number => {
  if (raw === undefined) return fallback
  const trimmed = raw.trim()
  if (!INTEGER_PATTERN.test(trimmed)) return fallback
  const n = Number.parseInt(trimmed, 10)
  return Number.isFinite(n) ? n : fallback
}

export const parseListParam = (raw: string | undefined): string[] => {
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

const USERNAME_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/

export const isValidUsername = (raw: string): boolean => USERNAME_PATTERN.test(raw)
