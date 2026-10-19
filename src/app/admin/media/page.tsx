import type { ReactNode } from 'react'
import { MediaEntry } from '@/features/media/media-entry'
import { serverOwner } from '@/server/runtime/context'

export default async function MediaPage(): Promise<ReactNode> {
  const owner = await serverOwner()
  return <MediaEntry owner={owner} />
}
