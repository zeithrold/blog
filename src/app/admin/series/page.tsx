import type { ReactNode } from 'react'
import { CatalogManager } from '@/features/catalog/catalog'
import { serverOwner, serverSessionToken } from '@/server/runtime/context'

export default async function SeriesPage(): Promise<ReactNode> {
  const owner = await serverOwner()
  return <CatalogManager kind="series" owner={owner} csrfToken={await serverSessionToken(owner)} />
}
