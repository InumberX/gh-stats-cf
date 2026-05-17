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

    if (res.status === 401 || res.status === 403) {
      lastError = createGitHubError(`GitHub API returned ${res.status}`, res.status, 'UNAUTHORIZED')
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
      throw createGitHubError(body.errors[0]?.message ?? 'GraphQL error', 502, 'GRAPHQL_ERROR')
    }

    if (!body.data) {
      throw createGitHubError('Empty response from GitHub', 502, 'BAD_RESPONSE')
    }

    return body.data
  }

  throw lastError ?? createGitHubError('All PATs failed', 502, 'BAD_RESPONSE')
}
