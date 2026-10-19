import type { PublicItem } from '@/server/reader/public-repository'
import type { Environment } from '@/server/runtime/environment'
import { trustedOrigin } from '@/server/auth/auth'
import { PublicRepository } from '@/server/reader/public-repository'

function xml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&apos;')
}
export async function feeds(path: string, env: Environment): Promise<Response | null> {
  const origin = trustedOrigin(env).origin
  const repository = new PublicRepository(env.DB)
  if (path === '/robots.txt') {
    return new Response(
      `User-agent: *\nDisallow: /admin\nDisallow: /api/admin\nSitemap: ${origin}/sitemap.xml\n`,
      {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
      },
    )
  }
  if (path === '/rss.xml') {
    const items = await repository.feed()
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel>
        <title>Zeithrold Blog</title><link>${xml(origin)}</link>
        <description>Notes on building things.</description>
        ${items.map(item => rssItem(item, origin)).join('')}</channel></rss>`,
      {
        headers: {
          'Content-Type': 'application/rss+xml; charset=utf-8',
        },
      },
    )
  }
  if (path === '/sitemap.xml' || /^\/sitemaps\/\d+\.xml$/.test(path)) {
    return await sitemap(path, origin, repository)
  }
  return null
}

function rssItem(item: PublicItem, origin: string): string {
  return `<item><title>${xml(item.title)}</title><link>${xml(origin + item.path)}</link>
    <guid isPermaLink="true">${xml(origin + item.path)}</guid><description>${xml(item.description)}</description>
    <pubDate>${new Date(item.publishedAt).toUTCString()}</pubDate></item>`
}

async function sitemap(
  path: string,
  origin: string,
  repository: PublicRepository,
): Promise<Response> {
  const count = await repository.routeCount()
  const pages = Math.max(1, Math.ceil(count / 1000))
  if (path === '/sitemap.xml' && pages > 1) {
    const links = Array.from(
      { length: pages },
      (_, page) => `<sitemap><loc>${xml(`${origin}/sitemaps/${page}.xml`)}</loc></sitemap>`,
    ).join('')
    return xmlResponse(
      `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${links}</sitemapindex>`,
    )
  }
  const page = path === '/sitemap.xml' ? 0 : Number(path.slice(10, -4))
  if (!Number.isSafeInteger(page) || page < 0 || page >= pages) {
    return new Response('Sitemap not found', { status: 404 })
  }
  const routes = await repository.routes(page * 1000)
  const home = page === 0 ? `<url><loc>${xml(origin)}</loc></url>` : ''
  const urls = routes
    .map(
      item =>
        `<url><loc>${xml(origin + item.path)}</loc>`
        + `<lastmod>${new Date(item.updatedAt).toISOString()}</lastmod></url>`,
    )
    .join('')
  return xmlResponse(
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${home}${urls}</urlset>`,
  )
}
function xmlResponse(body: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>${body}`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
}
