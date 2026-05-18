import { isValidUsername, parseIntParam } from '~/utils/query'

export type AppEnv = {
  Bindings: {
    PAT_1?: string
    PAT_2?: string
    PAT_3?: string
    PAT_4?: string
    PAT_5?: string
    CACHE_SECONDS?: string
    GITHUB_USERNAME?: string
  }
}

export const collectPats = (env: AppEnv['Bindings']): string[] => {
  return [env.PAT_1, env.PAT_2, env.PAT_3, env.PAT_4, env.PAT_5].filter(
    (v): v is string => typeof v === 'string' && v.length > 0
  )
}

// `GITHUB_USERNAME` fixes the worker to a single GitHub account. Returning
// `null` (rather than throwing here) lets the route render an SVG error card
// instead of crashing the request.
export const getOwnerUsername = (env: AppEnv['Bindings']): string | null => {
  const raw = env.GITHUB_USERNAME?.trim()
  if (!raw) return null
  return isValidUsername(raw) ? raw : null
}

const DEFAULT_CACHE_TTL = 86400

export const cacheTtlSeconds = (env: AppEnv['Bindings']): number => {
  const n = parseIntParam(env.CACHE_SECONDS, DEFAULT_CACHE_TTL)
  return n > 0 ? n : DEFAULT_CACHE_TTL
}
