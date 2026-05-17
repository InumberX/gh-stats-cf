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
    expect(svg).toContain("NiNE's GitHub Stats")
    expect(svg).toContain('1,234')
    expect(svg).toContain('A+')
  })

  it('omits title when hideTitle is true', () => {
    const svg = renderStatsCard(sampleStats, themes.radical, {
      showIcons: false,
      hideRank: false,
      hideBorder: false,
      hideTitle: true,
    })
    expect(svg).not.toContain("NiNE's GitHub Stats")
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
  it('produces an SVG with language names and percentages', () => {
    const svg = renderTopLangsCard(
      [
        { name: 'TypeScript', color: '#3178c6', size: 700 },
        { name: 'CSS', color: '#563d7c', size: 300 },
      ],
      themes.radical,
      { hideBorder: false, hideTitle: false }
    )
    expect(svg.trim().startsWith('<svg')).toBe(true)
    expect(svg).toContain('Most Used Languages')
    expect(svg).toContain('TypeScript 70.00%')
    expect(svg).toContain('CSS 30.00%')
  })

  it('handles single-language case without errors', () => {
    const svg = renderTopLangsCard([{ name: 'Go', color: '#00ADD8', size: 100 }], themes.default, {
      hideBorder: true,
      hideTitle: false,
    })
    expect(svg).toContain('Go 100.00%')
  })
})

describe('renderErrorCard', () => {
  it('embeds the message and escapes XML', () => {
    const svg = renderErrorCard('user "bad" not found', themes.default)
    expect(svg).toContain('user &quot;bad&quot; not found')
  })
})
