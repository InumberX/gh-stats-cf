export const parseBoolParam = (raw: string | undefined, fallback: boolean): boolean => {
  if (raw === undefined) return fallback
  const v = raw.toLowerCase()
  if (v === 'true' || v === '1' || v === 'yes') return true
  if (v === 'false' || v === '0' || v === 'no') return false
  return fallback
}

export const parseIntParam = (raw: string | undefined, fallback: number): number => {
  if (raw === undefined) return fallback
  const n = Number.parseInt(raw, 10)
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
