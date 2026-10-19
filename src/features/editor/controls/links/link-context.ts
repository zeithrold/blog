import type { LinkTarget } from '@/features/editor/engine/link-target'
import { createContext, use } from 'react'

export const EditorLinkContext = createContext<((target: LinkTarget) => void) | null>(null)

export function useEditorLinkCommand(): (target: LinkTarget) => void {
  const open = use(EditorLinkContext)
  if (open === null) {
    throw new Error('Link commands require their editor provider')
  }
  return open
}
