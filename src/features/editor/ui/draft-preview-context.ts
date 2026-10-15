import { createContext, use } from 'react'

export const DraftPreviewContext = createContext<{ show: (trigger: HTMLElement | null) => void } | null>(null)

export function useDraftPreview(): { show: (trigger: HTMLElement | null) => void } {
  const preview = use(DraftPreviewContext)
  if (preview === null) {
    throw new Error('Draft preview requires the editor workspace')
  }
  return preview
}
