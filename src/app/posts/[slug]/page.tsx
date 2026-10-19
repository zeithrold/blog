import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { SLUG } from '@/content/document'
import { DocumentReader } from '@/features/reader/document'
import { documentMetadata } from '@/server/reader/metadata'
import { StructuredData } from '@/server/reader/structured-data'
import { repository } from '@/server/runtime/context'

export default async function Post({
  params,
}: {
  params: Promise<{
    slug: string
  }>
}): Promise<ReactNode> {
  const { slug } = await params
  if (!SLUG.safeParse(slug).success) {
    notFound()
  }
  const entry = await repository().publicEntry(`/posts/${slug}`)
  if (entry === null) {
    notFound()
  }
  return (
    <>
      <StructuredData
        document={entry.document}
        kind="posts"
        publishedAt={entry.publishedAt}
        updatedAt={entry.updatedAt}
      />
      <DocumentReader
        document={entry.document}
        publication={{
          kind: 'posts',
          publishedAt: entry.publishedAt,
          updatedAt: entry.updatedAt,
        }}
      />
    </>
  )
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{
    slug: string
  }>
}): Promise<Metadata> {
  return await documentMetadata('posts', params)
}
