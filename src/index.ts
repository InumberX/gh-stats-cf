import { Hono } from 'hono'

import type { AppEnv } from '~/env'
import { statsRoute } from '~/routes/stats'
import { topLangsRoute } from '~/routes/top-langs'

const app = new Hono<AppEnv>()

app.get('/', (c) =>
  c.text(
    'gh-stats-cf — GitHub readme stats cards on Cloudflare Workers.\nSee /api?username=... and /api/top-langs?username=...'
  )
)

app.route('/api', statsRoute)
app.route('/api/top-langs', topLangsRoute)

export default app
