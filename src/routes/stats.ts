import { Hono } from 'hono'

import { renderErrorCard } from '~/cards/error'
import { renderStatsCard } from '~/cards/stats'
import type { AppEnv } from '~/env'
import { cacheTtlSeconds, collectPats, getOwnerUsername } from '~/env'
import { fetchStats } from '~/fetchers/stats'
import { buildTheme } from '~/themes'
import { cacheNormalizers, edgeCache } from '~/utils/edge-cache'
import { parseBoolParam } from '~/utils/query'
import { svgResponse } from '~/utils/svg-response'

// Query keys the stats route actually reads, each mapped to the same
// normalization the handler performs. Anything outside this map is dropped
// from the edge-cache key (see edgeCache / canonicalCacheKey).
//
// Exported so cache-key tests can pin on the production allow-list instead
// of duplicating it (drift between the two would silently weaken coverage).
export const STATS_QUERY_KEYS = {
  theme: cacheNormalizers.theme,
  title_color: cacheNormalizers.hex,
  icon_color: cacheNormalizers.hex,
  text_color: cacheNormalizers.hex,
  bg_color: cacheNormalizers.hex,
  border_color: cacheNormalizers.hex,
  show_icons: cacheNormalizers.bool,
  hide_rank: cacheNormalizers.bool,
  hide_border: cacheNormalizers.bool,
  hide_title: cacheNormalizers.bool,
} as const

export const statsRoute = new Hono<AppEnv>()

// Scope to the sub-app's root path only. With `use('*', ...)`, the
// middleware would also run for `/api/top-langs` (which mounts at `/api`'s
// parent path), letting this route's allow-list strip top-langs-only keys
// like `langs_count` and serve the wrong cached SVG to top-langs callers.
statsRoute.use('/', edgeCache({ allowedQueryKeys: STATS_QUERY_KEYS }))

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
