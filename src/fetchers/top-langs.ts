import { graphqlRequest } from '~/fetchers/github'

export type LanguageEntry = {
  name: string
  color: string
  size: number
}

type TopLangsResponse = {
  user: {
    repositories: {
      nodes: {
        languages: {
          edges: { size: number; node: { name: string; color: string | null } }[]
        }
      }[]
      pageInfo: { hasNextPage: boolean; endCursor: string | null }
    }
  } | null
}

// `privacy: PUBLIC` is required: even when the configured PAT can read the
// owner's private repositories, only public repo languages should be exposed
// through this public endpoint.
const TOP_LANGS_QUERY = `
  query userInfo($login: String!, $after: String) {
    user(login: $login) {
      repositories(
        first: 100
        after: $after
        ownerAffiliations: OWNER
        isFork: false
        privacy: PUBLIC
        orderBy: { direction: DESC, field: STARGAZERS }
      ) {
        nodes {
          languages(first: 10, orderBy: { direction: DESC, field: SIZE }) {
            edges {
              size
              node { name color }
            }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`

// Safety cap for repository pagination: 100 pages * 100 repos = 10,000 repos.
// Covers virtually every real GitHub account. If hit, the result is partial
// and a warning is logged.
const MAX_REPO_PAGES = 100

const DEFAULT_COLOR = '#858585'

export const fetchTopLangs = async (
  username: string,
  options: { pats: string[]; excludeLangs?: string[]; size?: number }
): Promise<LanguageEntry[]> => {
  const exclude = new Set((options.excludeLangs ?? []).map((s) => s.toLowerCase()))
  const totals = new Map<string, { size: number; color: string }>()
  let after: string | null = null
  let truncated = false

  for (let page = 0; page < MAX_REPO_PAGES; page++) {
    const data: TopLangsResponse = await graphqlRequest<TopLangsResponse>(
      TOP_LANGS_QUERY,
      { login: username, after },
      options.pats
    )
    if (!data.user) {
      throw new Error(`User not found: ${username}`)
    }
    for (const repo of data.user.repositories.nodes) {
      for (const edge of repo.languages.edges) {
        const name = edge.node.name
        if (exclude.has(name.toLowerCase())) continue
        const prev = totals.get(name)
        const color = edge.node.color ?? prev?.color ?? DEFAULT_COLOR
        totals.set(name, { size: (prev?.size ?? 0) + edge.size, color })
      }
    }
    if (!data.user.repositories.pageInfo.hasNextPage) break
    after = data.user.repositories.pageInfo.endCursor
    if (page === MAX_REPO_PAGES - 1) truncated = true
  }

  if (truncated) {
    console.warn(`Top-langs aggregation truncated at ${MAX_REPO_PAGES * 100} repos for user ${username}`)
  }

  const entries: LanguageEntry[] = Array.from(totals.entries())
    .map(([name, { size, color }]) => ({ name, size, color }))
    .sort((a, b) => b.size - a.size)

  const limit = options.size && options.size > 0 ? options.size : 5
  return entries.slice(0, limit)
}
