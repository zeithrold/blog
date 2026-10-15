import type { ReactNode } from 'react'
import { TaxonomyPage } from '@/features/reader/taxonomy-page'

export default function Tags(props: {
  params: Promise<{
    slug: string
  }>
  searchParams: Promise<{
    offset?: string
  }>
}): ReactNode {
  return <TaxonomyPage {...props} kind="tag" />
}
