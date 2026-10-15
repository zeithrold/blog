import type { ReactNode } from 'react'
import { DocumentList } from '@/features/documents/document-list'
import { serverOwner, serverSessionToken } from '@/server/context'

export default async function Admin(): Promise<ReactNode> {
  const owner = await serverOwner()
  return <DocumentList csrfToken={await serverSessionToken(owner)} />
}
