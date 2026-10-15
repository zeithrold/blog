'use client'
import type { UiText } from '@/i18n/use-translation'
import { useBlogTranslation, usePhraseTranslation } from '@/i18n/use-translation'

export function useSiteLocale(): string {
  return useBlogTranslation('site').locale
}

export function useSiteText(): UiText {
  return usePhraseTranslation('site')
}
