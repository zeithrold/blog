import type { ReactNode } from 'react'
import { OperationsPanel } from '@/features/operations/operations'
import { serverOwner, serverSessionToken } from '@/server/runtime/context'

export default async function OperationsPage(): Promise<ReactNode> {
  const owner = await serverOwner()
  return <OperationsPanel csrfToken={await serverSessionToken(owner)} />
}
