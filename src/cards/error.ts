import type { Theme } from '~/themes'
import { escapeXml } from '~/utils/svg'

// Word-wrap a message into at most `maxLines` lines, each at most
// `maxChars` characters wide. Words longer than `maxChars` are hard-split;
// content beyond `maxLines` is suffixed with `…` on the last line.
const wrapMessage = (message: string, maxChars: number, maxLines: number): string[] => {
  const lines: string[] = []
  let current = ''
  const pushCurrent = () => {
    if (current.length > 0) {
      lines.push(current)
      current = ''
    }
  }
  const push = (chunk: string) => {
    let remaining = chunk
    while (remaining.length > 0 && lines.length < maxLines) {
      const capacity = maxChars - current.length - (current.length > 0 ? 1 : 0)
      if (capacity <= 0) {
        pushCurrent()
        continue
      }
      if (remaining.length <= capacity) {
        current = current.length > 0 ? `${current} ${remaining}` : remaining
        remaining = ''
      } else if (remaining.length > maxChars && current.length === 0) {
        // The word itself is longer than a full line — hard-split it.
        current = remaining.slice(0, maxChars)
        remaining = remaining.slice(maxChars)
        pushCurrent()
      } else {
        pushCurrent()
      }
    }
  }
  for (const word of message.split(/\s+/).filter(Boolean)) {
    if (lines.length >= maxLines) break
    push(word)
  }
  pushCurrent()
  // If we ran out of room before consuming the whole message, mark the
  // overflow with an ellipsis on the final line.
  const consumed = lines.join(' ').length
  if (consumed < message.replace(/\s+/g, ' ').trim().length && lines.length > 0) {
    const last = lines[lines.length - 1] ?? ''
    const trimmed = last.length >= maxChars ? `${last.slice(0, maxChars - 1)}…` : `${last}…`
    lines[lines.length - 1] = trimmed
  }
  return lines.length > 0 ? lines : ['']
}

// Width 495 minus ~50px of horizontal padding leaves ~445px. 13px Segoe UI
// glyphs average ~6.5px, so ~68 characters per line is the safe ceiling.
const MAX_CHARS_PER_LINE = 68
const MAX_LINES = 4
const LINE_HEIGHT = 20
const HEADER_Y = 40
const FIRST_LINE_Y = 70
const HELP_GAP = 25

export const renderErrorCard = (message: string, theme: Theme): string => {
  const width = 495
  const lines = wrapMessage(message, MAX_CHARS_PER_LINE, MAX_LINES)
  const helpY = FIRST_LINE_Y + lines.length * LINE_HEIGHT + HELP_GAP - LINE_HEIGHT
  const height = helpY + 25

  const lineEls = lines
    .map((line, i) => `<text x="25" y="${FIRST_LINE_Y + i * LINE_HEIGHT}" class="msg">${escapeXml(line)}</text>`)
    .join('')

  return `<svg
    xmlns="http://www.w3.org/2000/svg"
    width="${width}"
    height="${height}"
    viewBox="0 0 ${width} ${height}"
    fill="none"
    role="img"
    aria-labelledby="titleId descId"
  >
    <title id="titleId">gh-stats-cf error</title>
    <desc id="descId">${escapeXml(message)}</desc>
    <style>
      .title { font: 700 16px 'Segoe UI', Ubuntu, Sans-Serif; fill: #${theme.title_color}; }
      .msg { font: 400 13px 'Segoe UI', Ubuntu, Sans-Serif; fill: #${theme.text_color}; }
    </style>
    <rect x="0.5" y="0.5" rx="4.5" width="${width - 1}" height="${
      height - 1
    }" fill="#${theme.bg_color}" stroke="#${theme.border_color}"/>
    <text x="25" y="${HEADER_Y}" class="title">Something went wrong</text>
    ${lineEls}
    <text x="25" y="${helpY}" class="msg">See https://github.com/InumberX/gh-stats-cf for help.</text>
  </svg>`
}

export const __test = { wrapMessage }
