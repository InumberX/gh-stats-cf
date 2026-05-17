import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchTopLangs } from '~/fetchers/top-langs'

type FetchMock = ReturnType<typeof vi.fn>

type Page = {
  nodes: { languages: { edges: { size: number; node: { name: string; color: string | null } }[] } }[]
  pageInfo: { hasNextPage: boolean; endCursor: string | null }
}

const respond = (pages: Page[]): Response => {
  const next = pages.shift()
  if (!next) throw new Error('No page available')
  return new Response(JSON.stringify({ data: { user: { repositories: next } } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('fetchTopLangs', () => {
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

  it('aggregates language sizes across repositories', async () => {
    const pages: Page[] = [
      {
        nodes: [
          {
            languages: {
              edges: [
                { size: 400, node: { name: 'TypeScript', color: '#3178c6' } },
                { size: 100, node: { name: 'CSS', color: '#563d7c' } },
              ],
            },
          },
          {
            languages: {
              edges: [{ size: 300, node: { name: 'TypeScript', color: '#3178c6' } }],
            },
          },
        ],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    ]
    fetchMock.mockImplementation(() => Promise.resolve(respond(pages)))

    const result = await fetchTopLangs('octocat', { pats: ['pat'] })

    expect(result).toEqual([
      { name: 'TypeScript', color: '#3178c6', size: 700 },
      { name: 'CSS', color: '#563d7c', size: 100 },
    ])
  })

  it('paginates while hasNextPage is true', async () => {
    const pages: Page[] = [
      {
        nodes: [{ languages: { edges: [{ size: 10, node: { name: 'Go', color: '#00ADD8' } }] } }],
        pageInfo: { hasNextPage: true, endCursor: 'cur-1' },
      },
      {
        nodes: [{ languages: { edges: [{ size: 5, node: { name: 'Go', color: '#00ADD8' } }] } }],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    ]
    fetchMock.mockImplementation(() => Promise.resolve(respond(pages)))

    const result = await fetchTopLangs('octocat', { pats: ['pat'] })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result).toEqual([{ name: 'Go', color: '#00ADD8', size: 15 }])
    const secondInit = fetchMock.mock.calls[1]?.[1] as RequestInit | undefined
    if (!secondInit) throw new Error('second call missing init')
    const secondCallBody = JSON.parse(secondInit.body as string) as {
      variables: { after: string | null }
    }
    expect(secondCallBody.variables.after).toBe('cur-1')
  })

  it('excludes languages by name (case-insensitive)', async () => {
    const pages: Page[] = [
      {
        nodes: [
          {
            languages: {
              edges: [
                { size: 100, node: { name: 'TypeScript', color: '#3178c6' } },
                { size: 50, node: { name: 'HTML', color: '#e34c26' } },
              ],
            },
          },
        ],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    ]
    fetchMock.mockImplementation(() => Promise.resolve(respond(pages)))

    const result = await fetchTopLangs('octocat', { pats: ['pat'], excludeLangs: ['html'] })

    expect(result.map((r) => r.name)).toEqual(['TypeScript'])
  })

  it('falls back to a default color when GitHub returns null', async () => {
    const pages: Page[] = [
      {
        nodes: [
          {
            languages: {
              edges: [{ size: 1, node: { name: 'Mystery', color: null } }],
            },
          },
        ],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    ]
    fetchMock.mockImplementation(() => Promise.resolve(respond(pages)))

    const result = await fetchTopLangs('octocat', { pats: ['pat'] })

    expect(result).toEqual([{ name: 'Mystery', size: 1, color: '#858585' }])
  })

  it('limits results to the requested size', async () => {
    const pages: Page[] = [
      {
        nodes: [
          {
            languages: {
              edges: [
                { size: 5, node: { name: 'A', color: '#111' } },
                { size: 4, node: { name: 'B', color: '#222' } },
                { size: 3, node: { name: 'C', color: '#333' } },
              ],
            },
          },
        ],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    ]
    fetchMock.mockImplementation(() => Promise.resolve(respond(pages)))

    const result = await fetchTopLangs('octocat', { pats: ['pat'], size: 2 })

    expect(result.map((r) => r.name)).toEqual(['A', 'B'])
  })

  it('throws when the user is not present', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { user: null } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    await expect(fetchTopLangs('ghost', { pats: ['pat'] })).rejects.toThrow(/User not found/)
  })
})
