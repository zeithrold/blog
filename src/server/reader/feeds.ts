import type { PublicItem } from '@/contracts/notion'
import type { Environment } from '@/server/runtime/environment'
import { tagUrl } from '@/contracts/notion'
import { readCatalog } from '@/server/notion/catalog'
import { publicOrigin } from '@/server/runtime/origin'

function xml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&apos;')
}

export async function feeds(path: string, env: Environment): Promise<Response | null> {
  if (![
    '/robots.txt',
    '/rss.xml',
    '/sitemap.xml',
  ].includes(path) && !/^\/sitemaps\/\d+\.xml$/.test(path)) {
    return null
  }
  const origin = publicOrigin(env)
  if (path === '/robots.txt') {
    return new Response(`User-agent: *\nDisallow: /api/\nSitemap: ${origin}/sitemap.xml\n`, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
  const { items, tagDescriptions } = await readCatalog(env)
  if (path === '/rss.xml') {
    const entries = items.filter(item => item.path.startsWith('/posts/')).slice(0, 100)
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel>`
      + `<title>Zeithrold Blog</title><link>${xml(origin)}</link>`
      + `<description>Notes on building things.</description>`
      + `${entries.map(item => rssItem(item, origin)).join('')}</channel></rss>`,
      { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } },
    )
  }
  const pages: SitemapPage[] = [
    ...items,
  ]
  if (tagDescriptions.length > 0) {
    pages.push({ path: '/tags' }, ...tagDescriptions.map(tag => ({ path: tagUrl(tag.id) })))
  }
  return sitemap(path, origin, pages)
}

function rssItem(item: PublicItem, origin: string): string {
  const url = xml(origin + item.path)
  return `<item><title>${xml(item.title)}</title><link>${url}</link>`
    + `<guid isPermaLink="true">${url}</guid><description>${xml(item.summary)}</description>`
    + `<pubDate>${new Date(item.publishedAt).toUTCString()}</pubDate></item>`
}

type SitemapPage = { readonly path: string, readonly updatedAt?: number }

function sitemap(path: string, origin: string, items: readonly SitemapPage[]): Response {
  const pages = Math.max(1, Math.ceil(items.length / 1000))
  if (path === '/sitemap.xml' && pages > 1) {
    return xmlResponse(
      `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${
        Array.from({ length: pages }, (_, page) =>
          `<sitemap><loc>${xml(`${origin}/sitemaps/${page}.xml`)}</loc></sitemap>`).join('')
      }</sitemapindex>`,
    )
  }
  const page = path === '/sitemap.xml' ? 0 : Number(path.slice(10, -4))
  if (!Number.isSafeInteger(page) || page < 0 || page >= pages) {
    return new Response('Sitemap not found', { status: 404 })
  }
  const home = page === 0 ? `<url><loc>${xml(origin)}</loc></url>` : ''
  const urls = items.slice(page * 1000, (page + 1) * 1000).map(item =>
    `<url><loc>${xml(origin + item.path)}</loc>${
      item.updatedAt === undefined ? '' : `<lastmod>${new Date(item.updatedAt).toISOString()}</lastmod>`
    }</url>`).join('')
  return xmlResponse(
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${home}${urls}</urlset>`,
  )
}

function xmlResponse(body: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>${body}`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
}
