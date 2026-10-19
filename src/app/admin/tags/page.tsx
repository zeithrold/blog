import type { ReactNode } from 'react'
import { CatalogManager } from '@/features/catalog/catalog'
import { serverOwner, serverSessionToken } from '@/server/runtime/context'

export default async function TagsPage(): Promise<ReactNode> {
  const owner = await serverOwner()
  return <CatalogManager kind="tag" owner={owner} csrfToken={await serverSessionToken(owner)} />
}
