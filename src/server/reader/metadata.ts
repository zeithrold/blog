import type { Metadata } from 'next'
import { env } from 'cloudflare:workers'
import { headers } from 'next/headers'
import { SLUG } from '@/content/document'
import { trustedOrigin } from '@/server/auth/auth'
import { repository } from '@/server/runtime/context'

export async function documentMetadata(
  kind: 'posts' | 'pages',
  params: Promise<{
    slug: string
  }>,
): Promise<Metadata> {
  const { slug } = await params
  if (!SLUG.safeParse(slug).success) {
    return {}
  }
  const document = await repository().publicDocument(`/${kind}/${slug}`)
  if (document === null) {
    return {}
  }
  const canonical = `${trustedOrigin(env).origin}/${kind}/${slug}`
  const preview = (await headers()).get('x-blog-request-origin') !== trustedOrigin(env).origin
  return {
    title: document.meta.title,
    description: document.meta.description,
    alternates: {
      canonical,
    },
    robots: {
      index: !document.meta.seo.noindex && !preview,
      follow: !preview,
    },
    openGraph: {
      type: kind === 'posts' ? 'article' : 'website',
      title: document.meta.title,
      description: document.meta.description,
      url: canonical,
      locale: document.meta.documentLocale === 'zh-CN' ? 'zh_CN' : 'en_US',
    },
  }
}
