import { Hono } from 'hono'

import { renderErrorCard } from '~/cards/error'
import { renderStatsCard } from '~/cards/stats'
import type { AppEnv } from '~/env'
import { cacheTtlSeconds, collectPats, isAllowedUser } from '~/env'
import { fetchStats } from '~/fetchers/stats'
import { buildTheme } from '~/themes'
import { edgeCache } from '~/utils/edge-cache'
import { isValidUsername, parseBoolParam } from '~/utils/query'
import { svgResponse } from '~/utils/svg-response'

export const statsRoute = new Hono<AppEnv>()

statsRoute.use('*', edgeCache())

statsRoute.get('/', async (c) => {
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

  const username = c.req.query('username')
  if (!username || !isValidUsername(username)) {
    return svgResponse(c, renderErrorCard('Invalid or missing `username` parameter.', theme), 60)
  }
  if (!isAllowedUser(env, username)) {
    return svgResponse(c, renderErrorCard('Username not allowed on this instance.', theme), 60)
  }

  const pats = collectPats(env)
  if (pats.length === 0) {
    return svgResponse(c, renderErrorCard('Server is missing PAT secret (PAT_1).', theme), 60)
  }

  try {
    const stats = await fetchStats(username, {
      pats,
      countPrivate: parseBoolParam(c.req.query('count_private'), false),
    })
    const svg = renderStatsCard(stats, theme, {
      showIcons: parseBoolParam(c.req.query('show_icons'), false),
      hideRank: parseBoolParam(c.req.query('hide_rank'), false),
      hideBorder: parseBoolParam(c.req.query('hide_border'), false),
      hideTitle: parseBoolParam(c.req.query('hide_title'), false),
    })
    return svgResponse(c, svg, cacheSeconds)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return svgResponse(c, renderErrorCard(message, theme), 60)
  }
})
