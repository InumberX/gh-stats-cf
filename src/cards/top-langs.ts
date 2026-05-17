import type { LanguageEntry } from '~/fetchers/top-langs'
import type { Theme } from '~/themes'
import { escapeXml } from '~/utils/svg'

export type TopLangsCardOptions = {
  hideBorder: boolean
  hideTitle: boolean
  username: string
}

const stripHash = (color: string): string => (color.startsWith('#') ? color.slice(1) : color)

export const renderTopLangsCard = (languages: LanguageEntry[], theme: Theme, options: TopLangsCardOptions): string => {
  const width = 300
  const padding = 25
  const barX = padding
  const barWidth = width - padding * 2
  const barHeight = 8

  const totalSize = languages.reduce((sum, l) => sum + l.size, 0) || 1
  const langs = languages.map((l) => ({
    name: l.name,
    color: stripHash(l.color),
    percent: (l.size / totalSize) * 100,
  }))

  let runningX = 0
  const barSegments = langs
    .map((l, i) => {
      const segWidth = (l.percent / 100) * barWidth
      const x = runningX
      runningX += segWidth
      // round outer edges of leftmost / rightmost segment
      const isFirst = i === 0
      const isLast = i === langs.length - 1
      const rx = isFirst || isLast ? 4 : 0
      const drawWidth = Math.max(0, segWidth)
      return `<rect x="${x.toFixed(2)}" y="0" width="${drawWidth.toFixed(
        2
      )}" height="${barHeight}" rx="${rx}" fill="#${l.color}"/>`
    })
    .join('')

  const itemsPerRow = 2
  const rowHeight = 24
  const colWidth = barWidth / itemsPerRow
  const listItems = langs
    .map((l, i) => {
      const col = i % itemsPerRow
      const row = Math.floor(i / itemsPerRow)
      const x = col * colWidth
      const y = row * rowHeight
      const percent = l.percent.toFixed(2)
      return `
        <g transform="translate(${x}, ${y})">
          <circle cx="5" cy="6" r="5" fill="#${l.color}"/>
          <text x="15" y="10" class="lang-name">${escapeXml(l.name)} ${percent}%</text>
        </g>
      `
    })
    .join('')

  const listRows = Math.ceil(langs.length / itemsPerRow)
  const listHeight = listRows * rowHeight

  const titleHeight = options.hideTitle ? 0 : 40
  const contentTop = titleHeight + 10
  const barY = contentTop
  const listY = barY + barHeight + 15
  const totalHeight = listY + listHeight + 10

  const titleEl = options.hideTitle ? '' : `<text x="${padding}" y="35" class="header">Most Used Languages</text>`

  const borderStroke = options.hideBorder ? 'none' : `#${theme.border_color}`

  return `<svg
    xmlns="http://www.w3.org/2000/svg"
    width="${width}"
    height="${totalHeight}"
    viewBox="0 0 ${width} ${totalHeight}"
    fill="none"
    role="img"
    aria-labelledby="titleId descId"
  >
    <title id="titleId">Most Used Languages for ${escapeXml(options.username)}</title>
    <desc id="descId">${langs.map((l) => `${escapeXml(l.name)} ${l.percent.toFixed(2)}%`).join(', ')}</desc>
    <style>
      .header {
        font: 600 18px 'Segoe UI', Ubuntu, Sans-Serif;
        fill: #${theme.title_color};
      }
      .lang-name {
        font: 400 11px 'Segoe UI', Ubuntu, Sans-Serif;
        fill: #${theme.text_color};
      }
    </style>
    <rect
      x="0.5" y="0.5"
      rx="4.5"
      width="${width - 1}"
      height="${totalHeight - 1}"
      fill="#${theme.bg_color}"
      stroke="${borderStroke}"
    />
    ${titleEl}
    <g transform="translate(${barX}, ${barY})">
      <mask id="bar-mask">
        <rect x="0" y="0" width="${barWidth}" height="${barHeight}" rx="4" fill="white"/>
      </mask>
      <g mask="url(#bar-mask)">
        ${barSegments}
      </g>
    </g>
    <g transform="translate(${barX}, ${listY})">
      ${listItems}
    </g>
  </svg>`
}
