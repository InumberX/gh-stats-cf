import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { GitHubError } from '~/fetchers/github'
import { graphqlRequest } from '~/fetchers/github'

type FetchMock = ReturnType<typeof vi.fn>

const jsonResponse = (body: unknown, init: ResponseInit = {}): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })

const errorResponse = (status: number, extraHeaders: Record<string, string> = {}): Response =>
  new Response(JSON.stringify({ message: 'err' }), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  })

const rateLimitedResponse = (
  message = 'API rate limit exceeded',
  headers: Record<string, string> = { 'x-ratelimit-remaining': '0' }
): Response =>
  new Response(JSON.stringify({ message }), {
    status: 403,
    headers: { 'Content-Type': 'application/json', ...headers },
  })

describe('graphqlRequest', () => {
  let fetchMock: FetchMock

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns data on success', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: { ok: true } }))
    const result = await graphqlRequest<{ ok: boolean }>('query { ok }', {}, ['pat-1'])
    expect(result).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('throws UNAUTHORIZED immediately when no PAT is configured', async () => {
    await expect(graphqlRequest('query { ok }', {}, [])).rejects.toMatchObject({
      kind: 'UNAUTHORIZED',
      status: 500,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rotates to the next PAT on 401', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(401))
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: { ok: true } }))
    // Force deterministic startIndex = 0
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const result = await graphqlRequest<{ ok: boolean }>('query { ok }', {}, ['pat-bad', 'pat-good'])
    expect(result).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const firstAuth = (fetchMock.mock.calls[0]?.[1] as RequestInit | undefined)?.headers as
      | Record<string, string>
      | undefined
    const secondAuth = (fetchMock.mock.calls[1]?.[1] as RequestInit | undefined)?.headers as
      | Record<string, string>
      | undefined
    expect(firstAuth?.Authorization).toBe('Bearer pat-bad')
    expect(secondAuth?.Authorization).toBe('Bearer pat-good')
  })

  it('rotates to the next PAT on plain 403 (no rate-limit signal)', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(403))
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: { ok: 1 } }))
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const result = await graphqlRequest<{ ok: number }>('q', {}, ['a', 'b'])
    expect(result).toEqual({ ok: 1 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('throws UNAUTHORIZED after all PATs fail with 401', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(errorResponse(401)))
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const err = (await graphqlRequest('q', {}, ['a', 'b']).catch((e) => e)) as GitHubError
    expect(err.kind).toBe('UNAUTHORIZED')
    expect(err.status).toBe(401)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('classifies a 403 with x-ratelimit-remaining=0 as RATE_LIMITED', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(rateLimitedResponse()))
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const err = (await graphqlRequest('q', {}, ['a', 'b']).catch((e) => e)) as GitHubError
    expect(err.kind).toBe('RATE_LIMITED')
    expect(err.status).toBe(429)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('classifies a 403 with retry-after as RATE_LIMITED (secondary limit)', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(rateLimitedResponse('You have exceeded a secondary rate limit', { 'retry-after': '60' }))
    )
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const err = (await graphqlRequest('q', {}, ['a']).catch((e) => e)) as GitHubError
    expect(err.kind).toBe('RATE_LIMITED')
    expect(err.status).toBe(429)
  })

  it('classifies a 403 with abuse-detection wording in body as RATE_LIMITED', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ message: 'abuse detection mechanism triggered' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    )
    const err = (await graphqlRequest('q', {}, ['a']).catch((e) => e)) as GitHubError
    expect(err.kind).toBe('RATE_LIMITED')
  })

  it('rotates on non-2xx and reports BAD_RESPONSE when all PATs fail', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(errorResponse(500)))
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const err = (await graphqlRequest('q', {}, ['a', 'b']).catch((e) => e)) as GitHubError
    expect(err.kind).toBe('BAD_RESPONSE')
    expect(err.status).toBe(500)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('throws NOT_FOUND without rotating', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ errors: [{ type: 'NOT_FOUND', message: 'Could not resolve to a User' }] })
    )
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const err = (await graphqlRequest('q', {}, ['a', 'b']).catch((e) => e)) as GitHubError
    expect(err.kind).toBe('NOT_FOUND')
    expect(err.status).toBe(404)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rotates on RATE_LIMITED error type', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ errors: [{ type: 'RATE_LIMITED', message: 'rate limited' }] }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: { ok: true } }))
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const result = await graphqlRequest<{ ok: boolean }>('q', {}, ['a', 'b'])
    expect(result).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('throws RATE_LIMITED when every PAT is rate limited', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse({ errors: [{ type: 'RATE_LIMITED', message: 'rate limited' }] }))
    )
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const err = (await graphqlRequest('q', {}, ['a', 'b']).catch((e) => e)) as GitHubError
    expect(err.kind).toBe('RATE_LIMITED')
    expect(err.status).toBe(429)
  })

  it('throws GRAPHQL_ERROR for non-rotatable graphql errors', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ errors: [{ message: 'something else' }] }))
    const err = (await graphqlRequest('q', {}, ['a']).catch((e) => e)) as GitHubError
    expect(err.kind).toBe('GRAPHQL_ERROR')
    expect(err.status).toBe(502)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('throws BAD_RESPONSE on empty data', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}))
    const err = (await graphqlRequest('q', {}, ['a']).catch((e) => e)) as GitHubError
    expect(err.kind).toBe('BAD_RESPONSE')
    expect(err.status).toBe(502)
  })
})
