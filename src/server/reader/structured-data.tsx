import type { ReactNode } from 'react'
import type { Document } from '@/content/document'
import { env } from 'cloudflare:workers'
import { headers } from 'next/headers'
import { safeStructuredJSON } from '@/content/structured-json'
import { trustedOrigin } from '@/server/auth/auth'

export async function StructuredData({
  document,
  kind,
  publishedAt,
  updatedAt,
}: {
  document: Document
  kind: 'posts' | 'pages'
  publishedAt: number
  updatedAt: number
}): Promise<ReactNode> {
  const nonce = (await headers()).get('x-blog-nonce') ?? ''
  const json = safeStructuredJSON({
    '@context': 'https://schema.org',
    '@type': kind === 'posts' ? 'BlogPosting' : 'WebPage',
    'headline': document.meta.title,
    'description': document.meta.description,
    'inLanguage': document.meta.documentLocale,
    'url': `${trustedOrigin(env).origin}/${kind}/${document.meta.slug}`,
    'datePublished': new Date(publishedAt).toISOString(),
    'dateModified': new Date(updatedAt).toISOString(),
    'author': { '@type': 'Person', 'name': 'Zeithrold' },
  })
  /* eslint-disable react/dom-no-dangerously-set-innerhtml -- HTML-safe JSON-LD serialization only. */
  return (
    <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: json }} />
  )
  /* eslint-enable react/dom-no-dangerously-set-innerhtml */
}
