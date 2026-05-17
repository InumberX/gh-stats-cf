import { Hono } from 'hono'

import type { AppEnv } from '~/env'
import { statsRoute } from '~/routes/stats'
import { topLangsRoute } from '~/routes/top-langs'

const app = new Hono<AppEnv>()

app.get('/', (c) =>
  c.text(
    'gh-stats-cf — GitHub readme stats cards on Cloudflare Workers.\n' +
      'Endpoints: /api (stats) and /api/top-langs (most-used languages).\n' +
      'The GitHub login served is fixed via the GITHUB_USERNAME env var, not a query parameter.'
  )
)

app.route('/api', statsRoute)
app.route('/api/top-langs', topLangsRoute)

export default app
