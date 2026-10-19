import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { UUID } from '@/content/document'
import { historySchema } from '@/contracts/history'
import { HistoryPage } from '@/features/history/history-page'
import { repository, serverOwner, serverSessionToken } from '@/server/runtime/context'

export default async function History({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<ReactNode> {
  const owner = await serverOwner()
  const { id } = await params
  if (!UUID.safeParse(id).success) {
    notFound()
  }
  const [initial, history, csrfToken] = await Promise.all([
    repository().open(id),
    repository().history(id),
    serverSessionToken(owner),
  ])
  return <HistoryPage initial={initial} history={historySchema.parse(history)} csrfToken={csrfToken} />
}
