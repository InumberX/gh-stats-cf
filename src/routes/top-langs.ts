import { Hono } from 'hono'

import { renderErrorCard } from '~/cards/error'
import { renderTopLangsCard } from '~/cards/top-langs'
import type { AppEnv } from '~/env'
import { cacheTtlSeconds, collectPats, getOwnerUsername } from '~/env'
import { fetchTopLangs } from '~/fetchers/top-langs'
import { buildTheme } from '~/themes'
import { edgeCache } from '~/utils/edge-cache'
import { parseBoolParam, parseIntParam, parseListParam } from '~/utils/query'
import { svgResponse } from '~/utils/svg-response'

export const topLangsRoute = new Hono<AppEnv>()

topLangsRoute.use('*', edgeCache())

topLangsRoute.get('/', async (c) => {
  const env = c.env
  const cacheSeconds = cacheTtlSeconds(env)
  const theme = buildTheme({
    theme: c.req.query('theme'),
    title_color: c.req.query('title_color'),
    icon_color: c.req.query('icon_color'),
    text_color: c.req.query('text_color'),
    bg_color: c.req.query('bg_color'),
    border_color: c.req.query('border_color'),
  })

  const username = getOwnerUsername(env)
  if (!username) {
    return svgResponse(c, renderErrorCard('Server is missing or has an invalid `GITHUB_USERNAME`.', theme), 60)
  }

  const pats = collectPats(env)
  if (pats.length === 0) {
    return svgResponse(c, renderErrorCard('Server is missing PAT secret (PAT_1).', theme), 60)
  }

  // Clamp `langs_count` to [1, 20] so a hostile caller can't ask the worker to
  // render an oversized SVG for accounts with many detected languages.
  const langsCountRaw = parseIntParam(c.req.query('langs_count'), 5)
  const langsCount = Math.min(20, Math.max(1, langsCountRaw))

  try {
    const languages = await fetchTopLangs(username, {
      pats,
      excludeLangs: parseListParam(c.req.query('exclude_langs')),
      size: langsCount,
    })
    if (languages.length === 0) {
      return svgResponse(c, renderErrorCard('No languages found for this user.', theme), 60)
    }
    const svg = renderTopLangsCard(languages, theme, {
      hideBorder: parseBoolParam(c.req.query('hide_border'), false),
      hideTitle: parseBoolParam(c.req.query('hide_title'), false),
      username,
    })
    return svgResponse(c, svg, cacheSeconds)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return svgResponse(c, renderErrorCard(message, theme), 60)
  }
})
