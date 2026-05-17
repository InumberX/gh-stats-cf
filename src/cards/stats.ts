import { renderIcon, type IconName } from '~/cards/icons'
import type { Stats } from '~/fetchers/stats'
import type { Theme } from '~/themes'

export type StatsCardOptions = {
  showIcons: boolean
  hideRank: boolean
  hideBorder: boolean
  hideTitle: boolean
}

const escapeXml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      default:
        return '&#39;'
    }
  })

type Row = { label: string; value: number; icon: IconName }

const ROWS = (stats: Stats): Row[] => [
  { label: 'Total Stars Earned:', value: stats.totalStars, icon: 'star' },
  { label: 'Total Commits:', value: stats.totalCommits, icon: 'commit' },
  { label: 'Total PRs:', value: stats.totalPRs, icon: 'pr' },
  { label: 'Total Issues:', value: stats.totalIssues, icon: 'issue' },
  { label: 'Contributed to (last year):', value: stats.contributedTo, icon: 'contrib' },
]

// Rank circle layout
const RANK_R = 40
const RANK_CX = 445
const RANK_CY = 95

const rankCircle = (percentile: number, color: string): string => {
  const circumference = 2 * Math.PI * RANK_R
  const progress = Math.max(0, Math.min(100, percentile)) / 100
  const offset = circumference * (1 - progress)
  return `
    <g transform="translate(${RANK_CX - RANK_R}, ${RANK_CY - RANK_R})">
      <circle cx="${RANK_R}" cy="${RANK_R}" r="${RANK_R}" fill="none" stroke="#${color}33" stroke-width="6"/>
      <circle
        cx="${RANK_R}" cy="${RANK_R}" r="${RANK_R}"
        fill="none" stroke="#${color}" stroke-width="6"
        stroke-linecap="round"
        stroke-dasharray="${circumference.toFixed(2)}"
        stroke-dashoffset="${offset.toFixed(2)}"
        transform="rotate(-90 ${RANK_R} ${RANK_R})"
      />
    </g>
  `
}

export const renderStatsCard = (stats: Stats, theme: Theme, options: StatsCardOptions): string => {
  const width = 495
  const padding = 25
  const rowHeight = 25
  const rowsTop = options.hideTitle ? 35 : 55
  const labelX = padding + (options.showIcons ? 25 : 0)
  const valueEndX = 340 // right-aligned end position for value text
  const rows = ROWS(stats)

  const rowEls = rows
    .map((row, i) => {
      const y = i * rowHeight
      const iconEl = options.showIcons
        ? `<g transform="translate(${padding}, ${y - 12})">${renderIcon(row.icon, theme.icon_color)}</g>`
        : ''
      return `
        <g class="stat-row" style="animation-delay: ${150 + i * 150}ms">
          ${iconEl}
          <text class="stat" x="${labelX}" y="${y}">${escapeXml(row.label)}</text>
          <text class="stat-value" x="${valueEndX}" y="${y}">${row.value.toLocaleString('en-US')}</text>
        </g>
      `
    })
    .join('')

  const contentHeight = rows.length * rowHeight
  const minHeight = options.hideRank ? rowsTop + contentHeight + 20 : Math.max(rowsTop + contentHeight + 20, 195)
  const height = minHeight

  const titleText = options.hideTitle ? '' : `${escapeXml(stats.name)}'s GitHub Stats`
  const titleEl = options.hideTitle ? '' : `<text x="${padding}" y="35" class="header">${titleText}</text>`

  const rankBlock = options.hideRank
    ? ''
    : `
      ${rankCircle(stats.rank.percentile, theme.title_color)}
      <text x="${RANK_CX}" y="${RANK_CY}" text-anchor="middle" dominant-baseline="central" class="rank-letter">${escapeXml(
        stats.rank.level
      )}</text>
    `

  const borderStroke = options.hideBorder ? 'none' : `#${theme.border_color}`

  return `<svg
    xmlns="http://www.w3.org/2000/svg"
    width="${width}"
    height="${height}"
    viewBox="0 0 ${width} ${height}"
    fill="none"
    role="img"
    aria-labelledby="titleId descId"
  >
    <title id="titleId">${escapeXml(titleText || `${stats.login} GitHub Stats`)}</title>
    <desc id="descId">GitHub stats card for ${escapeXml(stats.login)}</desc>
    <style>
      .header {
        font: 600 18px 'Segoe UI', Ubuntu, Sans-Serif;
        fill: #${theme.title_color};
      }
      .stat {
        font: 600 14px 'Segoe UI', Ubuntu, 'Helvetica Neue', Sans-Serif;
        fill: #${theme.text_color};
      }
      .stat-value {
        font: 700 14px 'Segoe UI', Ubuntu, 'Helvetica Neue', Sans-Serif;
        fill: #${theme.title_color};
        text-anchor: end;
      }
      .rank-letter {
        font: 800 38px 'Segoe UI', Ubuntu, Sans-Serif;
        fill: #${theme.text_color};
      }
      .icon { fill: #${theme.icon_color}; }
      .stat-row { opacity: 0; animation: fadeIn 0.5s ease-in-out forwards; }
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    </style>
    <rect
      x="0.5" y="0.5"
      rx="4.5"
      width="${width - 1}"
      height="${height - 1}"
      fill="#${theme.bg_color}"
      stroke="${borderStroke}"
    />
    ${titleEl}
    <g transform="translate(0, ${rowsTop + 20})">
      ${rowEls}
    </g>
    ${rankBlock}
  </svg>`
}
