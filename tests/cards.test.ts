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

  it('truncates the visible title for long display names but keeps the full name in <title>', () => {
    const longName = 'A'.repeat(60)
    const svg = renderStatsCard({ ...sampleStats, name: longName }, themes.default, {
      showIcons: false,
      hideRank: false,
      hideBorder: false,
      hideTitle: false,
    })
    // Accessible <title> keeps the full unescaped (then XML-escaped) name.
    expect(svg).toContain(`<title id="titleId">${longName}&#39;s GitHub Stats</title>`)
    // Visible <text class="header"> must NOT carry the full long name.
    expect(svg).not.toContain(`>${longName}&#39;s GitHub Stats</text>`)
    // It must include an ellipsis to signal truncation.
    expect(svg).toContain('…')
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

  it('truncates long language names with an ellipsis so rows do not overflow the column', () => {
    const svg = renderTopLangsCard([{ name: 'Jupyter Notebook', color: '#000', size: 1 }], themes.default, {
      hideBorder: false,
      hideTitle: false,
      username: 'u',
      size: 5,
    })
    // Visible <text> row carries a truncated name + ellipsis (slice to MAX-1).
    expect(svg).toContain('Jupyter Not… 100.00%')
    // Accessible description keeps the full name for screen readers.
    expect(svg).toContain('Jupyter Notebook 100.00%</desc>')
  })

  it('does not round individual bar segments (only the enclosing mask rounds the bar)', () => {
    const svg = renderTopLangsCard(
      [
        { name: 'A', color: '#111', size: 50 },
        { name: 'B', color: '#222', size: 30 },
        { name: 'C', color: '#333', size: 20 },
      ],
      themes.default,
      { hideBorder: false, hideTitle: false, username: 'u', size: 5 }
    )
    // Per-segment rounding would leave gaps where adjacent segments meet
    // (SVG `rx` rounds all four corners of a rect, including the inner
    // edges). The bar-mask handles outer rounding instead, so the bar
    // segments (rects with `y="0"` and a colored fill) must not carry an
    // `rx=` attribute. The mask's own rect uses `fill="white"` and is
    // excluded by this regex.
    const segmentRects = svg.match(/<rect[^>]*\by="0"[^>]*fill="#[0-9a-f]+"[^>]*\/>/gi) ?? []
    expect(segmentRects.length).toBe(3)
    for (const rect of segmentRects) {
      expect(rect).not.toMatch(/\brx=/)
    }
  })

  it('keeps short language names unchanged', () => {
    const svg = renderTopLangsCard([{ name: 'Go', color: '#000', size: 1 }], themes.default, {
      hideBorder: false,
      hideTitle: false,
      username: 'u',
      size: 5,
    })
    expect(svg).toContain('Go 100.00%')
    expect(svg).not.toContain('…')
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

  it('wraps long messages onto multiple lines and grows the card height', () => {
    const short = renderErrorCard('rate limit exceeded', themes.default)
    const longMsg =
      'The GitHub GraphQL API returned a long, descriptive error message that should wrap across multiple lines so the user can actually read what went wrong with their request when they are debugging.'
    const long = renderErrorCard(longMsg, themes.default)

    const heightOf = (svg: string): number => {
      const m = svg.match(/height="(\d+)"/)
      if (!m) throw new Error('height not found')
      return Number.parseInt(m[1] ?? '0', 10)
    }
    expect(heightOf(long)).toBeGreaterThan(heightOf(short))
    // Multiple `<text class="msg">` elements appear for wrapped lines (in
    // addition to the static help link).
    const msgLineCount = long.split('class="msg"').length - 1
    expect(msgLineCount).toBeGreaterThanOrEqual(3)
    // Accessible description still carries the full untruncated message.
    expect(long).toContain(`<desc id="descId">${longMsg}</desc>`)
  })

  it('caps wrapped output at MAX_LINES and marks overflow with an ellipsis', () => {
    const huge = 'word '.repeat(200).trim()
    const svg = renderErrorCard(huge, themes.default)
    expect(svg).toContain('…')
  })

  it('marks overflow with an ellipsis for an unbroken word that exceeds maxChars * maxLines', () => {
    // 68 chars/line * 4 lines = 272 chars max. A single unbroken word of
    // 275 chars exceeds that. The earlier reconstruction-based detector
    // counted hard-split chunks joined by spaces, which made `consumed`
    // appear larger than the original and dropped the ellipsis.
    const huge = 'x'.repeat(275)
    const svg = renderErrorCard(huge, themes.default)
    expect(svg).toContain('…')
  })
})
