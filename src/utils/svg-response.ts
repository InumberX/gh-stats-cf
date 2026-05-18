import type { Context } from 'hono'

export const svgResponse = (c: Context, svg: string, cacheSeconds: number): Response => {
  return c.body(svg, 200, {
    'Content-Type': 'image/svg+xml; charset=utf-8',
    'Cache-Control': `public, max-age=${cacheSeconds}, s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds}`,
    'Access-Control-Allow-Origin': '*',
  })
}
