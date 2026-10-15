import type { i18n } from 'i18next'
import type { I18nAdapter, I18nValues, Locale } from '@/components/ui/ztd-me'
import { createInstance } from 'i18next'
import { createI18nAdapter, LOCALES } from '@/components/ui/ztd-me'
import { en } from '@/i18n/resources/en'
import { zhCN } from '@/i18n/resources/zh-CN'

export type BlogNamespace = keyof typeof en
export type BlogMessageKey<N extends BlogNamespace> = Extract<keyof (typeof en)[N], string>
export type TranslationValues = I18nValues
export type BlogTranslator<N extends BlogNamespace> = (key: BlogMessageKey<N>, values?: TranslationValues) => string

// Share the validated adapter within one engine, without retaining roots or server requests.
const adapters = new WeakMap<i18n, I18nAdapter<typeof en>>()

// Every root or server request creates its own instance; only resources are shared.
export function createBlogI18n(locale: Locale): i18n {
  const instance = createInstance()
  instance.init({
    lng: locale,
    fallbackLng: 'en',
    supportedLngs: [
      ...LOCALES,
    ],
    ns: [
      'site',
      'editor',
      'documents',
    ],
    defaultNS: 'site',
    resources: { en, 'zh-CN': zhCN },
    initAsync: false,
    keySeparator: false,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  }).catch(reportTranslationError)
  return instance
}

export function reportTranslationError(error: unknown): void {
  console.error('Could not apply Blog UI language', error)
}

export function createBlogAdapter(instance: i18n): I18nAdapter<typeof en> {
  const existing = adapters.get(instance)
  if (existing !== undefined) {
    return existing
  }
  const adapter = createI18nAdapter({
    instance: {
      translate: ({ locale, namespace, key, values }) => String(instance.t(key, {
        ...interpolationValues(values),
        lng: locale,
        ns: namespace,
      })),
    },
    resources: { en, 'zh-CN': zhCN },
  })
  adapters.set(instance, adapter)
  return adapter
}

export function blogTranslator<N extends BlogNamespace>(instance: i18n, namespace: N): BlogTranslator<N> {
  return (key, values) => String(instance.t(key, {
    ...interpolationValues(values),
    lng: instance.resolvedLanguage ?? instance.language,
    ns: namespace,
  }))
}

function interpolationValues(values: TranslationValues | undefined): Record<string, string | number> {
  const options = { ...values }
  delete options.lngs
  return options
}

export function serverBlogTranslator<N extends BlogNamespace>(locale: Locale, namespace: N): BlogTranslator<N> {
  return blogTranslator(createBlogI18n(locale), namespace)
}
