import { describe, expect, it } from 'vitest'

import { renderErrorCard } from '~/cards/error'
import { renderStatsCard } from '~/cards/stats'
import { renderTopLangsCard } from '~/cards/top-langs'
import { themes } from '~/themes'

const sampleStats = {
  name: 'NiNE',
  login: 'InumberX',
  totalStars: 42,
  totalCommits: 1234,
  totalPRs: 56,
  totalIssues: 78,
  contributedTo: 9,
  rank: { level: 'A+', percentile: 5.5 },
}

describe('renderStatsCard', () => {
  it('produces an SVG with the username title and totals', () => {
    const svg = renderStatsCard(sampleStats, themes.radical, {
      showIcons: true,
      hideRank: false,
      hideBorder: false,
      hideTitle: false,
    })
    expect(svg.trim().startsWith('<svg')).toBe(true)
    expect(svg).toContain('NiNE&#39;s GitHub Stats')
    expect(svg).toContain('1,234')
    expect(svg).toContain('A+')
    expect(svg).toContain('Commits (last year):')
  })

  it('does not double-encode XML entities in the accessible title', () => {
    const svg = renderStatsCard({ ...sampleStats, name: 'A&B' }, themes.default, {
      showIcons: false,
      hideRank: true,
      hideBorder: false,
      hideTitle: false,
    })
    expect(svg).toContain('<title id="titleId">A&amp;B&#39;s GitHub Stats</title>')
    expect(svg).not.toContain('&amp;amp;')
  })

  it('omits title when hideTitle is true', () => {
    const svg = renderStatsCard(sampleStats, themes.radical, {
      showIcons: false,
      hideRank: false,
      hideBorder: false,
      hideTitle: true,
    })
    expect(svg).not.toContain('NiNE&#39;s GitHub Stats')
  })

  it('escapes HTML in name', () => {
    const svg = renderStatsCard({ ...sampleStats, name: '<script>' }, themes.default, {
      showIcons: false,
      hideRank: true,
      hideBorder: false,
      hideTitle: false,
    })
    expect(svg).not.toContain('<script>')
    expect(svg).toContain('&lt;script&gt;')
  })
})

describe('renderTopLangsCard', () => {
  it('produces an SVG with language names, percentages and accessible name', () => {
    const svg = renderTopLangsCard(
      [
        { name: 'TypeScript', color: '#3178c6', size: 700 },
        { name: 'CSS', color: '#563d7c', size: 300 },
      ],
      themes.radical,
      { hideBorder: false, hideTitle: false, username: 'InumberX', size: 5 }
    )
    expect(svg.trim().startsWith('<svg')).toBe(true)
    expect(svg).toContain('Most Used Languages')
    expect(svg).toContain('TypeScript 70.00%')
    expect(svg).toContain('CSS 30.00%')
    expect(svg).toContain('aria-labelledby')
    expect(svg).toContain('<title id="titleId">Most Used Languages for InumberX</title>')
  })

  it('handles single-language case without errors', () => {
    const svg = renderTopLangsCard([{ name: 'Go', color: '#00ADD8', size: 100 }], themes.default, {
      hideBorder: true,
      hideTitle: false,
      username: 'octocat',
      size: 5,
    })
    expect(svg).toContain('Go 100.00%')
  })

  it('escapes user-supplied username in accessible title', () => {
    const svg = renderTopLangsCard([{ name: 'TS', color: '#000', size: 1 }], themes.default, {
      hideBorder: false,
      hideTitle: false,
      username: '<x>',
      size: 5,
    })
    expect(svg).not.toContain('<x>GitHub')
    expect(svg).toContain('&lt;x&gt;')
  })

  it('computes percentages relative to the full included total (top-N truncation does not renormalize)', () => {
    // With sizes 50/30/20 (sum = 100) and size=2, the visible rows must
    // report 50% / 30% — not 62.5% / 37.5% as if the truncated subset
    // were the whole.
    const svg = renderTopLangsCard(
      [
        { name: 'JS', color: '#000', size: 50 },
        { name: 'TS', color: '#000', size: 30 },
        { name: 'Go', color: '#000', size: 20 },
      ],
      themes.default,
      { hideBorder: false, hideTitle: false, username: 'InumberX', size: 2 }
    )
    expect(svg).toContain('JS 50.00%')
    expect(svg).toContain('TS 30.00%')
    // The dropped row must NOT appear in the rendered list.
    expect(svg).not.toContain('Go ')
  })

  it('truncates to `size` rows but keeps the percent denominator over all entries', () => {
    const svg = renderTopLangsCard(
      [
        { name: 'A', color: '#000', size: 5 },
        { name: 'B', color: '#000', size: 4 },
        { name: 'C', color: '#000', size: 3 },
      ],
      themes.default,
      { hideBorder: false, hideTitle: false, username: 'u', size: 2 }
    )
    expect(svg).toContain('A 41.67%')
    expect(svg).toContain('B 33.33%')
    expect(svg).not.toContain('C ')
  })
})

describe('renderErrorCard', () => {
  it('embeds the message and escapes XML', () => {
    const svg = renderErrorCard('user "bad" not found', themes.default)
    expect(svg).toContain('user &quot;bad&quot; not found')
  })

  it('exposes the error message via accessible description', () => {
    const svg = renderErrorCard('rate limit exceeded', themes.default)
    expect(svg).toContain('aria-labelledby')
    expect(svg).toContain('<desc id="descId">rate limit exceeded</desc>')
  })
})
