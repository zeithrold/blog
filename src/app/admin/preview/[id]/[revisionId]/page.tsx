import type { ReactNode } from 'react'
import { EyeOff } from 'lucide-react'
import { notFound } from 'next/navigation'
import { UUID } from '@/content/document'
import { DocumentReader } from '@/features/reader/document'
import { SiteText } from '@/i18n/site-text'
import { repository, serverOwner } from '@/server/runtime/context'

const utility1Class = [
  'w-[min(var(--blog-reading-width),_calc(100%_-_48px))] mt-6 mx-auto mb-0 border-transparent',
].join(' ')

const layout1Class = [
  'preview-notice my-4 py-3 px-4 border rounded-[12px] flex items-center gap-2',
  utility1Class,
  'bg-muted text-muted-foreground text-help',
].join(' ')

export default async function Preview({
  params,
}: {
  params: Promise<{
    id: string
    revisionId: string
  }>
}): Promise<ReactNode> {
  await serverOwner()
  const { id, revisionId } = await params
  if (!UUID.safeParse(id).success || !UUID.safeParse(revisionId).success) {
    notFound()
  }
  const revision = await repository().revision(id, revisionId)
  return (
    <>
      <p className={layout1Class}>
        <EyeOff size={15} aria-hidden="true" />
        <SiteText value="Private revision preview" />
      </p>
      <DocumentReader document={revision.document} privatePreview />
    </>
  )
}
