'use client'
import type { ReactNode } from 'react'
import type { ComponentOptions, ComponentSurface } from './contract'
import type { FrontendPreferences } from '@/components/ui/ztd-me'
import { useEffect } from 'react'
import { createPreferencePolicy } from '@/components/ui/ztd-me'
import { CatalogManager } from '@/features/catalog/catalog'
import { DocumentList } from '@/features/documents/document-list'
import { BlogFrontend } from '@/i18n/frontend'
import { COMPONENT_TEST_FIXTURES } from './fixtures'

// A local, host-only preference cookie keeps this provider self-contained; it
// never shares product persistence with the real app.
const componentPolicy = createPreferencePolicy({
  name: 'blog.component.harness.v1',
  secure: false,
})

export function Harness({ options }: { options: ComponentOptions }): ReactNode {
  // The marker belongs to the initial commit, not to loaded data: specs that
  // deliberately hold the HTTP request must still be able to read loading state.
  useEffect(() => {
    document.documentElement.dataset.componentHarness = 'mounted'
  }, [])
  return (
    <BlogFrontend initialPreferences={preferencesFor(options)} policy={componentPolicy}>
      <div className="min-h-screen bg-background font-sans text-body leading-[1.6] text-foreground antialiased">
        <div data-component-surface={options.surface}>
          {surfaceContent(options.surface)}
        </div>
      </div>
    </BlogFrontend>
  )
}

function preferencesFor(options: ComponentOptions): FrontendPreferences {
  return {
    version: 1,
    mode: options.mode,
    palette: 'neutral',
    locale: options.locale === 'zh' ? 'zh-CN' : 'en',
  }
}

function surfaceContent(surface: ComponentSurface): ReactNode {
  const { csrfToken, owner } = COMPONENT_TEST_FIXTURES
  switch (surface) {
    case 'documents':
      return <DocumentList csrfToken={csrfToken} />
    case 'catalog-tag':
      return <CatalogManager kind="tag" csrfToken={csrfToken} owner={owner} />
    case 'catalog-series':
      return <CatalogManager kind="series" csrfToken={csrfToken} owner={owner} />
    default:
      throw new Error(`Unsupported component surface ${JSON.stringify(surface)}`)
  }
}
