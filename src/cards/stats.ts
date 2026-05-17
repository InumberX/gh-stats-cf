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

const rankCircle = (percentile: number, color: string): string => {
  const CIRCUMFERENCE = 2 * Math.PI * 40
  const progress = Math.max(0, Math.min(100, percentile)) / 100
  const offset = CIRCUMFERENCE * (1 - progress)
  return `
    <g transform="translate(${405}, ${47.5})">
      <circle cx="40" cy="40" r="40" fill="none" stroke="#${color}33" stroke-width="6"/>
      <circle
        cx="40" cy="40" r="40"
        fill="none" stroke="#${color}" stroke-width="6"
        stroke-linecap="round"
        stroke-dasharray="${CIRCUMFERENCE.toFixed(2)}"
        stroke-dashoffset="${offset.toFixed(2)}"
        transform="rotate(-90 40 40)"
      />
    </g>
  `
}

export const renderStatsCard = (stats: Stats, theme: Theme, options: StatsCardOptions): string => {
  const width = 495
  const height = 195
  const rows = ROWS(stats)
  const rankVisible = !options.hideRank
  const labelX = options.showIcons ? 25 + 24 : 25
  const valueX = options.showIcons ? 220 : 195

  const rowEls = rows
    .map((row, i) => {
      const y = i * 25
      const icon = options.showIcons ? renderIcon(row.icon, theme.icon_color) : ''
      const iconG = options.showIcons ? `<g transform="translate(0, ${y - 12})">${icon}</g>` : ''
      return `
        <g transform="translate(0, ${y})" class="stat-row" style="animation-delay: ${150 + i * 150}ms">
          ${iconG}
          <text class="stat" x="${labelX}" y="0">${escapeXml(row.label)}</text>
          <text class="stat-value" x="${valueX}" y="0">${row.value.toLocaleString('en-US')}</text>
        </g>
      `
    })
    .join('')

  const rankBlock = rankVisible
    ? `
      ${rankCircle(stats.rank.percentile, theme.title_color)}
      <text x="${405 + 40}" y="${47.5 + 47}" text-anchor="middle" class="rank-letter">${escapeXml(
        stats.rank.level
      )}</text>
    `
    : ''

  const titleText = options.hideTitle ? '' : `${escapeXml(stats.name)}'s GitHub Stats`

  const titleEl = options.hideTitle ? '' : `<text x="25" y="35" class="header">${titleText}</text>`

  const borderStroke = options.hideBorder ? 'none' : `#${theme.border_color}`
  const contentStartY = options.hideTitle ? 35 : 55

  return `<svg
    xmlns="http://www.w3.org/2000/svg"
    width="${width}"
    height="${height}"
    viewBox="0 0 ${width} ${height}"
    fill="none"
    role="img"
    aria-labelledby="descId"
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
    <g transform="translate(25, ${contentStartY + 20})">
      ${rowEls}
    </g>
    ${rankBlock}
  </svg>`
}
