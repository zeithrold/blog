import type { ReactNode } from 'react'
import { useEditorLabels } from '@/i18n/use-labels'

export function EditorText({ value }: { value: string }): ReactNode {
  return useEditorLabels()(value)
}
