import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchStats } from '~/fetchers/stats'

type FetchMock = ReturnType<typeof vi.fn>

type CountsBody = {
  user: {
    name: string | null
    login: string
    contributionsCollection: { totalCommitContributions: number }
    repositoriesContributedTo: { totalCount: number }
    followers: { totalCount: number }
  } | null
  publicPRs: { issueCount: number }
  publicIssues: { issueCount: number }
  publicReviews: { issueCount: number }
}

type StarsPage = {
  nodes: { stargazerCount: number }[]
  pageInfo: { hasNextPage: boolean; endCursor: string | null }
}

const json = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

const countsResult = (overrides: Partial<CountsBody> = {}): CountsBody => ({
  user: {
    name: 'NiNE',
    login: 'InumberX',
    contributionsCollection: { totalCommitContributions: 123 },
    repositoriesContributedTo: { totalCount: 7 },
    followers: { totalCount: 11 },
  },
  publicPRs: { issueCount: 9 },
  publicIssues: { issueCount: 4 },
  publicReviews: { issueCount: 6 },
  ...overrides,
})

describe('fetchStats', () => {
  let fetchMock: FetchMock

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('aggregates counts and paginates stars', async () => {
    const starsPages: StarsPage[] = [
      {
        nodes: [{ stargazerCount: 10 }, { stargazerCount: 5 }],
        pageInfo: { hasNextPage: true, endCursor: 'cur-1' },
      },
      {
        nodes: [{ stargazerCount: 3 }],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    ]
    let starsCall = 0
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as { query: string }
      if (body.query.includes('userCounts')) {
        return Promise.resolve(json({ data: countsResult() }))
      }
      const page = starsPages[starsCall++]
      if (!page) throw new Error('no stars page')
      return Promise.resolve(json({ data: { user: { repositories: page } } }))
    })

    const stats = await fetchStats('InumberX', { pats: ['pat'] })

    expect(stats.name).toBe('NiNE')
    expect(stats.login).toBe('InumberX')
    expect(stats.totalStars).toBe(18)
    expect(stats.totalCommits).toBe(123)
    expect(stats.totalPRs).toBe(9)
    expect(stats.totalIssues).toBe(4)
    expect(stats.contributedTo).toBe(7)
    expect(stats.rank.level).toMatch(/^[SABC][+-]?$/)
    expect(starsCall).toBe(2)
  })

  it('uses login when name is null', async () => {
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as { query: string }
      if (body.query.includes('userCounts')) {
        return Promise.resolve(
          json({
            data: countsResult({
              user: {
                name: null,
                login: 'octocat',
                contributionsCollection: { totalCommitContributions: 0 },
                repositoriesContributedTo: { totalCount: 0 },
                followers: { totalCount: 0 },
              },
            }),
          })
        )
      }
      return Promise.resolve(
        json({
          data: { user: { repositories: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } } },
        })
      )
    })

    const stats = await fetchStats('octocat', { pats: ['pat'] })
    expect(stats.name).toBe('octocat')
  })

  it('uses Search API search queries with is:public (no archived filter)', async () => {
    const sentVariables: Record<string, unknown>[] = []
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as { query: string; variables: Record<string, unknown> }
      sentVariables.push(body.variables)
      if (body.query.includes('userCounts')) {
        return Promise.resolve(json({ data: countsResult() }))
      }
      return Promise.resolve(
        json({
          data: { user: { repositories: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } } },
        })
      )
    })

    await fetchStats('InumberX', { pats: ['pat'] })

    const countsVars = sentVariables[0] ?? {}
    expect(countsVars.publicPrQuery).toBe('is:pr author:InumberX is:public')
    expect(countsVars.publicIssueQuery).toBe('is:issue author:InumberX is:public')
    expect(countsVars.publicReviewQuery).toBe('is:pr reviewed-by:InumberX is:public')
    // archived:false would silently drop archived repos — must not be present.
    expect(JSON.stringify(countsVars)).not.toContain('archived')
  })

  it('throws when the counts response has no user', async () => {
    fetchMock.mockResolvedValueOnce(
      json({
        data: {
          user: null,
          publicPRs: { issueCount: 0 },
          publicIssues: { issueCount: 0 },
          publicReviews: { issueCount: 0 },
        },
      })
    )

    await expect(fetchStats('ghost', { pats: ['pat'] })).rejects.toThrow(/User not found/)
  })
})
