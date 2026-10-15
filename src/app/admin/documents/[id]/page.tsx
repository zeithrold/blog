import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { UUID } from '@/content/document'
import { DynamicEditor } from '@/features/editor/ui/dynamic'
import { repository, serverOwner, serverSessionToken } from '@/server/context'

export default async function Edit({
  params,
}: {
  params: Promise<{
    id: string
  }>
}): Promise<ReactNode> {
  const owner = await serverOwner()
  const { id } = await params
  if (!UUID.safeParse(id).success) {
    notFound()
  }
  const initial = await repository().open(id)
  return (
    <DynamicEditor initial={initial} owner={owner} csrfToken={await serverSessionToken(owner)} />
  )
}
