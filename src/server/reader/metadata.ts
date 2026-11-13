import type { Metadata } from 'next'
import { env } from 'cloudflare:workers'
import { slugSchema } from '@/contracts/notion'
import { publicPage } from '@/server/runtime/context'
import { publicOrigin } from '@/server/runtime/origin'

export async function documentMetadata(
  kind: 'posts' | 'pages',
  params: Promise<{ readonly slug: string }>,
): Promise<Metadata> {
  const { slug } = await params
  if (!slugSchema.safeParse(slug).success) {
    return {}
  }
  const page = await publicPage(`/${kind}/${slug}`)
  if (page === null) {
    return {}
  }
  const { item } = page
  const origin = publicOrigin(env)
  const canonical = origin + item.path
  return {
    title: item.title,
    description: item.summary,
    alternates: { canonical },
    openGraph: {
      type: kind === 'posts' ? 'article' : 'website',
      title: item.title,
      description: item.summary,
      url: canonical,
      ...(item.cover === null
        ? {}
        : { images: [
            { url: `${origin}/notion-media/${item.id}/cover` },
          ] }),
    },
  }
}
