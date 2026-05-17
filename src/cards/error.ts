import type { Theme } from '~/themes'

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

export const renderErrorCard = (message: string, theme: Theme): string => {
  const width = 495
  const height = 120
  return `<svg
    xmlns="http://www.w3.org/2000/svg"
    width="${width}"
    height="${height}"
    viewBox="0 0 ${width} ${height}"
    fill="none"
    role="img"
  >
    <style>
      .title { font: 700 16px 'Segoe UI', Ubuntu, Sans-Serif; fill: #${theme.title_color}; }
      .msg { font: 400 13px 'Segoe UI', Ubuntu, Sans-Serif; fill: #${theme.text_color}; }
    </style>
    <rect x="0.5" y="0.5" rx="4.5" width="${width - 1}" height="${
      height - 1
    }" fill="#${theme.bg_color}" stroke="#${theme.border_color}"/>
    <text x="25" y="40" class="title">Something went wrong</text>
    <text x="25" y="70" class="msg">${escapeXml(message)}</text>
    <text x="25" y="95" class="msg">See https://github.com/InumberX/gh-stats-cf for help.</text>
  </svg>`
}
