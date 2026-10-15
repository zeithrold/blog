'use client'
import type { i18n } from 'i18next'
import type { I18nBinding } from '@/components/ui/ztd-me/client'
import type { BlogNamespace, BlogTranslator, TranslationValues } from '@/i18n/instance'
import type { en } from '@/i18n/resources/en'
import { use, useMemo } from 'react'
import { I18nContext } from 'react-i18next'
import { useI18n } from '@/components/ui/ztd-me/client'
import { createBlogAdapter } from '@/i18n/instance'
import { phraseKeys } from '@/i18n/phrase-keys'

export type UiText = (value: string, values?: TranslationValues) => string

export function useBlogTranslation<N extends BlogNamespace>(namespace: N): {
  t: BlogTranslator<N>
  locale: string
} {
  const { binding } = useBlogBinding()
  return { t: (key, values) => binding.t(namespace, key, values), locale: binding.locale }
}

export function usePhraseTranslation(namespace: BlogNamespace): UiText {
  const { binding, adapter } = useBlogBinding()
  return (value, values) => {
    const namespaces: BlogNamespace[] = [
      namespace,
      ...([
        'editor',
        'site',
        'documents',
      ] as const).filter(item => item !== namespace),
    ]
    for (const candidate of namespaces) {
      const keys: Readonly<Record<string, string>> = phraseKeys[candidate]
      const key = keys[value]
      if (key !== undefined) {
        return adapter.instance.translate({ locale: binding.locale, namespace: candidate, key, values: values ?? {} })
      }
    }
    return value
  }
}

function useBlogBinding(): {
  binding: I18nBinding<typeof en>
  adapter: ReturnType<typeof createBlogAdapter>
} {
  const instance = requireBlogInstance(use(I18nContext))
  const adapter = useMemo(() => createBlogAdapter(instance), [instance])
  const binding = useI18n(adapter)
  return { binding, adapter }
}

function requireBlogInstance(context: { i18n: i18n } | undefined): i18n {
  if (context === undefined) {
    throw new Error('Blog translations require BlogFrontend or an explicit I18nextProvider.')
  }
  return context.i18n
}
