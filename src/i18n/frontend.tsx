'use client'
import type { ReactNode } from 'react'
import type { FrontendPreferences, PreferencePolicy } from '@/components/ui/ztd-me'
import { useCallback, useState } from 'react'
import { I18nextProvider } from 'react-i18next'
import { FrontendProvider } from '@/components/ui/ztd-me/client'
import { createBlogI18n, reportTranslationError } from '@/i18n/instance'

export function BlogFrontend({ children, initialPreferences, policy, styleNonce }: {
  children: ReactNode
  initialPreferences: FrontendPreferences
  policy: PreferencePolicy
  styleNonce?: string
}): ReactNode {
  const [instance] = useState(() => createBlogI18n(initialPreferences.locale))
  const updateLocale = useCallback((preferences: FrontendPreferences) => {
    if (instance.resolvedLanguage !== preferences.locale) {
      instance.changeLanguage(preferences.locale).catch(reportTranslationError)
    }
  }, [instance])
  return (
    <FrontendProvider
      initialPreferences={initialPreferences}
      policy={policy}
      styleNonce={styleNonce}
      onPreferencesChange={updateLocale}
    >
      <I18nextProvider i18n={instance}>{children}</I18nextProvider>
    </FrontendProvider>
  )
}
