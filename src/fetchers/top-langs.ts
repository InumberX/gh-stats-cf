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
        name: string
        languages: {
          edges: { size: number; node: { name: string; color: string | null } }[]
        }
      }[]
      pageInfo: { hasNextPage: boolean; endCursor: string | null }
    }
  } | null
}

const TOP_LANGS_QUERY = `
  query userInfo($login: String!, $after: String) {
    user(login: $login) {
      repositories(
        first: 100
        after: $after
        ownerAffiliations: OWNER
        isFork: false
        orderBy: { direction: DESC, field: STARGAZERS }
      ) {
        nodes {
          name
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

const DEFAULT_COLOR = '#858585'

export const fetchTopLangs = async (
  username: string,
  options: { pats: string[]; excludeLangs?: string[]; size?: number }
): Promise<LanguageEntry[]> => {
  const exclude = new Set((options.excludeLangs ?? []).map((s) => s.toLowerCase()))
  const totals = new Map<string, { size: number; color: string }>()
  let after: string | null = null

  for (let page = 0; page < 10; page++) {
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
  }

  const entries: LanguageEntry[] = Array.from(totals.entries())
    .map(([name, { size, color }]) => ({ name, size, color }))
    .sort((a, b) => b.size - a.size)

  const limit = options.size && options.size > 0 ? options.size : 5
  return entries.slice(0, limit)
}
