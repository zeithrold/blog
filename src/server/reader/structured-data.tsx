import type { ReactNode } from 'react'
import type { PublicItem } from '@/contracts/notion'
import { env } from 'cloudflare:workers'
import { headers } from 'next/headers'
import { publicOrigin } from '@/server/runtime/origin'
import { shareImage } from './share'

export async function StructuredData({ item }: { readonly item: PublicItem }): Promise<ReactNode> {
  const nonce = (await headers()).get('x-blog-nonce') ?? ''
  const origin = publicOrigin(env)
  const canonical = origin + item.path
  const json = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': item.path.startsWith('/posts/') ? 'BlogPosting' : 'WebPage',
    'headline': item.title,
    'description': item.summary,
    'url': canonical,
    'image': shareImage(origin, item).url,
    ...(item.path.startsWith('/posts/')
      ? { mainEntityOfPage: { '@type': 'WebPage', '@id': canonical } }
      : {}),
    'datePublished': new Date(item.publishedAt).toISOString(),
    'dateModified': new Date(item.updatedAt).toISOString(),
    'author': { '@type': 'Person', 'name': 'Zeithrold', 'url': 'https://github.com/zeithrold' },
  }).replaceAll('<', '\\u003c').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029')
  /* eslint-disable react/dom-no-dangerously-set-innerhtml -- HTML-safe JSON-LD serialization only. */
  return <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: json }} />
  /* eslint-enable react/dom-no-dangerously-set-innerhtml */
}
