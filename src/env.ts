export type AppEnv = {
  Bindings: {
    PAT_1?: string
    PAT_2?: string
    PAT_3?: string
    PAT_4?: string
    PAT_5?: string
    CACHE_SECONDS?: string
    WHITELIST?: string
  }
}

export const collectPats = (env: AppEnv['Bindings']): string[] => {
  return [env.PAT_1, env.PAT_2, env.PAT_3, env.PAT_4, env.PAT_5].filter(
    (v): v is string => typeof v === 'string' && v.length > 0
  )
}

export const isAllowedUser = (env: AppEnv['Bindings'], username: string): boolean => {
  if (!env.WHITELIST) return true
  const allowed = env.WHITELIST.split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  if (allowed.length === 0) return true
  return allowed.includes(username.toLowerCase())
}

export const cacheTtlSeconds = (env: AppEnv['Bindings']): number => {
  const raw = env.CACHE_SECONDS
  if (!raw) return 86400
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : 86400
}
