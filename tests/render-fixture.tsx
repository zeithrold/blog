import type { ReactNode } from 'react'
import type { Locale } from '../src/components/ui/ztd-me'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider } from 'react-i18next'
import { createPreferencePolicy, DEFAULT_PREFERENCES } from '../src/components/ui/ztd-me'
import { FrontendProvider } from '../src/components/ui/ztd-me/client'
import { createBlogI18n } from '../src/i18n/instance'

export function renderWithLocale(element: ReactNode, locale: Locale = 'en'): string {
  const i18n = createBlogI18n(locale)
  return renderToStaticMarkup(
    <FrontendProvider
      initialPreferences={{ ...DEFAULT_PREFERENCES, locale }}
      policy={createPreferencePolicy({ name: 'blog-render-fixture', secure: false })}
    >
      <I18nextProvider i18n={i18n}>{element}</I18nextProvider>
    </FrontendProvider>,
  )
}
