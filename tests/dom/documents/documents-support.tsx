import type { FrontendPreferences, Locale } from '@/components/ui/ztd-me'
import type { ApiHandler, ApiService } from '~/tests/dom/shared/http'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { toast } from 'sonner'
import { expect } from 'vitest'
import { createPreferencePolicy } from '@/components/ui/ztd-me'
import { DocumentList } from '@/features/documents/document-list'
import { BlogFrontend } from '@/i18n/frontend'
import {
  all,
  button,
  click,
  combobox,
  field,
  one,
  openCombobox,
  option,
  press,
  selectNative,
  text,
  texts,
  typeText,
} from '~/tests/dom/shared/dom'
import {
  drainHostTask,
  installBrowserShims,
  setMediaState,
  until,
} from '~/tests/dom/shared/environment'
import { serveFetch } from '~/tests/dom/shared/http'

export {
  all,
  button,
  click,
  combobox,
  drainHostTask,
  field,
  one,
  openCombobox,
  option,
  press,
  selectNative,
  text,
  texts,
  typeText,
  until,
}

type TestLocale = 'en' | 'zh'
const csrfToken = 'dom-documents-csrf'
const preferencePolicy = createPreferencePolicy({
  name: 'blog.dom.documents.v1',
  secure: false,
})

function preferences(locale: TestLocale, mode: 'light' | 'dark'): FrontendPreferences {
  const productLocale: Locale = locale === 'zh' ? 'zh-CN' : 'en'
  return { version: 1, mode, palette: 'neutral', locale: productLocale }
}

export type DocumentsDomView = {
  readonly container: HTMLElement
  readonly api: ApiService
  unmount: () => void
}

const views: DocumentsDomView[] = []
const services: ApiService[] = []

/** Mounts the real Documents surface in BlogFrontend with only its fetch boundary declared. */
export function mountDocuments(input: {
  readonly handlers: Readonly<Record<string, ApiHandler>>
  readonly locale?: TestLocale
  readonly mode?: 'light' | 'dark'
  readonly width?: number
}): DocumentsDomView {
  installBrowserShims()
  setMediaState({
    width: input.width ?? 1440,
    dark: input.mode === 'dark',
    reducedMotion: false,
  })
  const api = serveFetch(input.handlers)
  services.push(api)
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  act(() => {
    root.render(
      <BlogFrontend
        initialPreferences={preferences(input.locale ?? 'en', input.mode ?? 'light')}
        policy={preferencePolicy}
      >
        <DocumentList csrfToken={csrfToken} />
      </BlogFrontend>,
    )
  })
  let unmounted = false
  const view: DocumentsDomView = {
    container,
    api,
    unmount: () => {
      if (unmounted) {
        return
      }
      unmounted = true
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
  views.push(view)
  return view
}

/** Narrows a labeled text input without test-side type assertions. */
export function textInput(root: ParentNode, label: string): HTMLInputElement {
  const control = field(root, label)
  if (!(control instanceof HTMLInputElement)) {
    throw new TypeError(`The "${label}" control is not an input`)
  }
  return control
}

/** Flushes the declared HTTP replies through the real component lifecycle. */
export async function settleDocuments(view: DocumentsDomView): Promise<void> {
  await drainHostTask()
  await act(async () => {
    await view.api.expectServed()
    await drainHostTask()
  })
}

/** Waits for the single confirmed notification Sonner renders and checks it. */
export async function expectToast(view: DocumentsDomView, message: string): Promise<void> {
  await act(async () => {
    await until(() => view.container.querySelector('[data-sonner-toast]') !== null)
  })
  expect(one(view.container, '[data-sonner-toast]').textContent).toContain(message)
}

/** Unmounts each view and restores the prior fetch boundary. */
export function resetDocumentsDom(): void {
  try {
    for (const view of views.splice(0)) {
      view.unmount()
    }
    act(() => {
      toast.dismiss()
    })
  }
  finally {
    const active = services.splice(0)
    for (const api of active.slice().reverse()) {
      api.dispose()
    }
    for (const api of active) {
      expect(api.unhandled).toEqual([])
    }
  }
}
