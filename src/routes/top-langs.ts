import { Hono } from 'hono'

import { renderErrorCard } from '~/cards/error'
import { renderTopLangsCard } from '~/cards/top-langs'
import type { AppEnv } from '~/env'
import { cacheTtlSeconds, collectPats, isAllowedUser } from '~/env'
import { fetchTopLangs } from '~/fetchers/top-langs'
import { buildTheme } from '~/themes'
import { isValidUsername, parseBoolParam, parseIntParam, parseListParam } from '~/utils/query'
import { svgResponse } from '~/utils/svg-response'

export const topLangsRoute = new Hono<AppEnv>()

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
    const languages = await fetchTopLangs(username, {
      pats,
      excludeLangs: parseListParam(c.req.query('exclude_langs')),
      size: parseIntParam(c.req.query('langs_count'), 5),
    })
    if (languages.length === 0) {
      return svgResponse(c, renderErrorCard('No languages found for this user.', theme), 60)
    }
    const svg = renderTopLangsCard(languages, theme, {
      hideBorder: parseBoolParam(c.req.query('hide_border'), false),
      hideTitle: parseBoolParam(c.req.query('hide_title'), false),
    })
    return svgResponse(c, svg, cacheSeconds)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return svgResponse(c, renderErrorCard(message, theme), 60)
  }
})
