import type { Theme } from '~/themes'
import { escapeXml } from '~/utils/svg'

// Word-wrap a message into at most `maxLines` lines, each at most
// `maxChars` characters wide. Words longer than `maxChars` are hard-split;
// content beyond `maxLines` is suffixed with `…` on the last line.
//
// Overflow detection walks an explicit `cursor` over the normalized input
// rather than reconstructing it from the emitted lines. The reconstruction
// approach silently inserted spaces between hard-split chunks that were
// never in the original (e.g. a single 300-char word), masking the
// overflow for unbroken long strings just over `maxChars * maxLines`.
const wrapMessage = (message: string, maxChars: number, maxLines: number): string[] => {
  const normalized = message.replace(/\s+/g, ' ').trim()
  const lines: string[] = []
  let current = ''
  let cursor = 0

  const flush = () => {
    if (current.length > 0) {
      lines.push(current)
      current = ''
    }
  }

  while (cursor < normalized.length && lines.length < maxLines) {
    if (normalized[cursor] === ' ') {
      cursor++
      continue
    }
    const spaceIdx = normalized.indexOf(' ', cursor)
    const wordEnd = spaceIdx === -1 ? normalized.length : spaceIdx
    const word = normalized.slice(cursor, wordEnd)
    const need = current.length === 0 ? word.length : 1 + word.length
    const room = maxChars - current.length

    if (need <= room) {
      current = current.length === 0 ? word : `${current} ${word}`
      cursor = wordEnd
    } else if (current.length === 0 && word.length > maxChars) {
      // Word itself is wider than a single line — hard-split it.
      current = word.slice(0, maxChars)
      cursor += maxChars
      flush()
    } else {
      flush()
    }
  }
  flush()

  if (cursor < normalized.length && lines.length > 0) {
    const last = lines[lines.length - 1] ?? ''
    lines[lines.length - 1] = last.length >= maxChars ? `${last.slice(0, maxChars - 1)}…` : `${last}…`
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
