'use client'
import type { UiText } from '@/i18n/use-translation'
import { usePhraseTranslation } from '@/i18n/use-translation'
import { apiErrorMessages } from '@/shared/admin/errors'

export function useEditorLabels(): UiText {
  const text = usePhraseTranslation('editor')
  return (value, values) => text(apiErrorMessages[value] ?? value, values)
}
