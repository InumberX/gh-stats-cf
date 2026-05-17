import { describe, expect, it } from 'vitest'

import { __test } from '~/fetchers/stats'

describe('rank calculation', () => {
  it('assigns C to a brand-new account', () => {
    const r = __test.calculateRank({
      commits: 0,
      prs: 0,
      issues: 0,
      reviews: 0,
      stars: 0,
      followers: 0,
      includeAllCommits: false,
    })
    expect(r.level).toBe('C')
  })

  it('assigns S to a power user', () => {
    const r = __test.calculateRank({
      commits: 50_000,
      prs: 5_000,
      issues: 2_500,
      reviews: 500,
      stars: 100_000,
      followers: 50_000,
      includeAllCommits: true,
    })
    expect(['S', 'A+']).toContain(r.level)
  })

  it('exponentialCdf is monotonically increasing on [0, ∞)', () => {
    expect(__test.exponentialCdf(0)).toBe(0)
    expect(__test.exponentialCdf(1)).toBeGreaterThan(0)
    expect(__test.exponentialCdf(10)).toBeGreaterThan(__test.exponentialCdf(1))
    expect(__test.exponentialCdf(100)).toBeLessThan(1.01)
  })
})
