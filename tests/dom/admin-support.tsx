/* eslint-disable react-refresh/only-export-components -- DOM-layer support, not a Fast Refresh boundary. */
import type { ReactNode } from 'react'
import type { ApiHandler, ApiService } from './http'
import type { Locale } from '@/components/ui/ztd-me'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { createPreferencePolicy } from '@/components/ui/ztd-me'
import { CatalogManager } from '@/features/catalog/catalog'
import { BlogFrontend } from '@/i18n/frontend'
import { AdminControlsSurface, AdminNavigationSurface } from '~/tests/components/src/admin-harness'
import { COMPONENT_TEST_FIXTURES } from '~/tests/components/src/fixtures'
import { catalogPage, documentsPage } from '~/tests/components/support/domain-fixtures'
import { installBrowserShims, setMediaState } from './environment'
import { serveFetch } from './http'

export type AdminSurface = 'controls' | 'navigation' | 'catalog'

export type MountedAdmin = {
  readonly container: HTMLElement
  readonly api: ApiService
  unmount: () => void
}

const mounted: MountedAdmin[] = []
const activeApis: ApiService[] = []
let nextPolicy = 1

function preferences(locale: Locale) {
  return { version: 1 as const, mode: 'light' as const, palette: 'neutral' as const, locale }
}

function Surface({ kind }: { kind: AdminSurface }): ReactNode {
  switch (kind) {
    case 'controls': {
      return <AdminControlsSurface />
    }
    case 'navigation': {
      return <AdminNavigationSurface />
    }
    case 'catalog': {
      return (
        <CatalogManager
          kind="tag"
          csrfToken={COMPONENT_TEST_FIXTURES.csrfToken}
          owner={COMPONENT_TEST_FIXTURES.owner}
        />
      )
    }
  }
}

function AdminHarness({
  kind,
  locale,
  policy,
}: {
  kind: AdminSurface
  locale: Locale
  policy: ReturnType<typeof createPreferencePolicy>
}): ReactNode {
  return (
    <BlogFrontend initialPreferences={preferences(locale)} policy={policy}>
      <Surface kind={kind} />
    </BlogFrontend>
  )
}

/** Mounts the real admin surface inside the application i18n/preferences providers. */
export async function mountAdmin(input: {
  kind: AdminSurface
  width?: number
  locale?: Locale
  reducedMotion?: boolean
  route?: string
  handlers?: Readonly<Record<string, ApiHandler>>
}): Promise<MountedAdmin> {
  installBrowserShims()
  setMediaState({
    width: input.width ?? 1440,
    reducedMotion: input.reducedMotion ?? false,
    dark: false,
  })
  const route = input.route ?? ({
    controls: '/admin/documents',
    navigation: '/admin/operations',
    catalog: '/admin/tags',
  } satisfies Record<AdminSurface, string>)[input.kind]
  window.history.replaceState({}, '', route)
  const defaults: Record<string, ApiHandler> = {}
  if (input.kind === 'controls') {
    defaults['GET /api/admin/documents'] = () => ({ body: documentsPage([]) })
  }
  if (input.kind === 'catalog') {
    defaults['GET /api/admin/catalog/tag'] = () => ({ body: catalogPage([]) })
  }
  const api = serveFetch({ ...defaults, ...input.handlers })
  activeApis.push(api)
  const policy = createPreferencePolicy({
    name: `blog.dom.admin.${nextPolicy++}.v1`,
    secure: false,
  })
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  let disposed = false
  await act(async () => {
    root.render(<AdminHarness kind={input.kind} locale={input.locale ?? 'en'} policy={policy} />)
    await api.settle()
  })
  const view: MountedAdmin = {
    container,
    api,
    unmount: () => {
      if (disposed) {
        return
      }
      disposed = true
      act(() => root.unmount())
      container.remove()
    },
  }
  mounted.push(view)
  return view
}

/** Unmounts every surface, restores fetch and fails on an undeclared request. */
export async function resetAdmin(): Promise<void> {
  try {
    for (const view of mounted.splice(0)) {
      view.unmount()
    }
  }
  finally {
    const apis = activeApis.splice(0)
    for (const api of apis.slice().reverse()) {
      api.dispose()
    }
    for (const api of apis) {
      await api.expectServed()
    }
    window.history.replaceState({}, '', '/')
  }
}
