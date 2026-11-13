import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { slugSchema } from '@/contracts/notion'
import { DocumentReader } from '@/features/reader/document'
import { documentMetadata } from '@/server/reader/metadata'
import { StructuredData } from '@/server/reader/structured-data'
import { publicPage } from '@/server/runtime/context'

export default async function Page({
  params,
}: {
  params: Promise<{
    slug: string
  }>
}): Promise<ReactNode> {
  const { slug } = await params
  if (!slugSchema.safeParse(slug).success) {
    notFound()
  }
  const entry = await publicPage(`/pages/${slug}`)
  if (entry === null) {
    notFound()
  }
  return (
    <>
      <StructuredData item={entry.item} />
      <DocumentReader page={entry} />
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
  return await documentMetadata('pages', params)
}
