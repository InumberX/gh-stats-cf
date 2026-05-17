import { Hono } from 'hono'

import { renderErrorCard } from '~/cards/error'
import { renderStatsCard } from '~/cards/stats'
import type { AppEnv } from '~/env'
import { cacheTtlSeconds, collectPats, getOwnerUsername } from '~/env'
import { fetchStats } from '~/fetchers/stats'
import { buildTheme } from '~/themes'
import { edgeCache } from '~/utils/edge-cache'
import { parseBoolParam } from '~/utils/query'
import { svgResponse } from '~/utils/svg-response'

// Query keys the stats route actually reads. Anything outside this set is
// dropped from the edge-cache key (see edgeCache / canonicalCacheKey).
const STATS_QUERY_KEYS: ReadonlySet<string> = new Set([
  'theme',
  'title_color',
  'icon_color',
  'text_color',
  'bg_color',
  'border_color',
  'show_icons',
  'hide_rank',
  'hide_border',
  'hide_title',
])

export const statsRoute = new Hono<AppEnv>()

statsRoute.use('*', edgeCache({ allowedQueryKeys: STATS_QUERY_KEYS }))

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

  const username = getOwnerUsername(env)
  if (!username) {
    return svgResponse(c, renderErrorCard('Server is missing or has an invalid `GITHUB_USERNAME`.', theme), 60)
  }

  const pats = collectPats(env)
  if (pats.length === 0) {
    return svgResponse(c, renderErrorCard('Server is missing PAT secret (PAT_1).', theme), 60)
  }

  try {
    const stats = await fetchStats(username, { pats })
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
