const GRAPHQL_ENDPOINT = 'https://api.github.com/graphql'

export type GitHubErrorKind = 'NOT_FOUND' | 'RATE_LIMITED' | 'UNAUTHORIZED' | 'BAD_RESPONSE' | 'GRAPHQL_ERROR'

export type GitHubError = Error & {
  status: number
  kind: GitHubErrorKind
}

export const createGitHubError = (message: string, status: number, kind: GitHubErrorKind): GitHubError => {
  const err = new Error(message) as GitHubError
  err.name = 'GitHubError'
  err.status = status
  err.kind = kind
  return err
}

type GraphQLResponse<T> = {
  data?: T
  errors?: { type?: string; message: string }[]
}

// GitHub returns HTTP 403 for both bad credentials AND rate / abuse limits.
// Heuristics to distinguish the rate-limit case:
//   - `x-ratelimit-remaining: 0` means primary rate limit exhausted.
//   - `retry-after` header is set on abuse / secondary rate limits.
//   - The body's `message` mentions "rate limit" or "abuse" wording.
// Anything else with status 403 (or 401) is treated as UNAUTHORIZED so the
// rotation loop tries the next PAT.
const isRateLimited403 = async (res: Response): Promise<boolean> => {
  if (res.headers.get('x-ratelimit-remaining') === '0') return true
  if (res.headers.get('retry-after')) return true
  try {
    const cloned = res.clone()
    const text = await cloned.text()
    return /rate limit|abuse/i.test(text)
  } catch {
    return false
  }
}

export const graphqlRequest = async <T>(
  query: string,
  variables: Record<string, unknown>,
  pats: string[]
): Promise<T> => {
  if (pats.length === 0) {
    throw createGitHubError('No PAT configured (set PAT_1 secret)', 500, 'UNAUTHORIZED')
  }

  const startIndex = Math.floor(Math.random() * pats.length)
  let lastError: GitHubError | null = null

  for (let i = 0; i < pats.length; i++) {
    const pat = pats[(startIndex + i) % pats.length]
    if (!pat) continue

    const res = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${pat}`,
        'Content-Type': 'application/json',
        'User-Agent': 'gh-stats-cf',
      },
      body: JSON.stringify({ query, variables }),
    })

    if (res.status === 401) {
      lastError = createGitHubError('GitHub API returned 401', 401, 'UNAUTHORIZED')
      continue
    }

    if (res.status === 403) {
      if (await isRateLimited403(res)) {
        lastError = createGitHubError('GitHub API rate limit exceeded (403)', 429, 'RATE_LIMITED')
      } else {
        lastError = createGitHubError('GitHub API returned 403', 403, 'UNAUTHORIZED')
      }
      continue
    }

    // GitHub also uses HTTP 429 (in addition to 403 with rate-limit headers)
    // for primary / secondary rate limiting. Treat it as RATE_LIMITED and
    // rotate so callers do not see a misleading BAD_RESPONSE.
    if (res.status === 429) {
      lastError = createGitHubError('GitHub API rate limit exceeded (429)', 429, 'RATE_LIMITED')
      continue
    }

    if (!res.ok) {
      lastError = createGitHubError(`GitHub API returned ${res.status}`, res.status, 'BAD_RESPONSE')
      continue
    }

    const body = (await res.json()) as GraphQLResponse<T>

    if (body.errors && body.errors.length > 0) {
      const notFound = body.errors.some((e) => e.type === 'NOT_FOUND')
      if (notFound) throw createGitHubError(body.errors[0]?.message ?? 'Not found', 404, 'NOT_FOUND')
      const rateLimited = body.errors.some((e) => e.type === 'RATE_LIMITED')
      if (rateLimited) {
        lastError = createGitHubError('Rate limit exceeded', 429, 'RATE_LIMITED')
        continue
      }
      // Authorization-style GraphQL errors (e.g. `FORBIDDEN`, or messages
      // like "Resource not accessible by personal access token") can apply
      // to a single mis-scoped PAT — rotate to the next one rather than
      // failing the whole request.
      const isAuthError = body.errors.some(
        (e) =>
          e.type === 'FORBIDDEN' ||
          e.type === 'UNAUTHORIZED' ||
          /not accessible by .*token|insufficient.*scope|requires.*scope/i.test(e.message)
      )
      if (isAuthError) {
        lastError = createGitHubError(body.errors[0]?.message ?? 'GraphQL authorization error', 403, 'UNAUTHORIZED')
        continue
      }
      throw createGitHubError(body.errors[0]?.message ?? 'GraphQL error', 502, 'GRAPHQL_ERROR')
    }

    if (!body.data) {
      throw createGitHubError('Empty response from GitHub', 502, 'BAD_RESPONSE')
    }

    return body.data
  }

  throw lastError ?? createGitHubError('All PATs failed', 502, 'BAD_RESPONSE')
}
