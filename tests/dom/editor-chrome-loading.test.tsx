import type { ReactNode } from 'react'
import type { FrontendPreferences } from '@/components/ui/ztd-me'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it } from 'vitest'
import { createPreferencePolicy } from '@/components/ui/ztd-me'
import { LoadingEditor } from '@/features/editor/workspace/editor-loading'
import { BlogFrontend } from '@/i18n/frontend'
import { all, one, text } from './dom'
import { installBrowserShims, setMediaState } from './environment'

const preferences: FrontendPreferences = {
  version: 1,
  mode: 'light',
  palette: 'neutral',
  locale: 'en',
}

const policy = createPreferencePolicy({
  name: 'blog.dom.editor-loading.v1',
  secure: false,
})

let container: HTMLElement | null = null
let root: ReturnType<typeof createRoot> | null = null

function LoadingSurface(): ReactNode {
  return (
    <BlogFrontend initialPreferences={preferences} policy={policy}>
      <LoadingEditor />
    </BlogFrontend>
  )
}

afterEach(() => {
  if (root !== null) {
    act(() => root?.unmount())
    root = null
  }
  container?.remove()
  container = null
})

it('the real editor fallback renders its loading status, spinner and skeleton structure', () => {
  installBrowserShims()
  setMediaState({ width: 1440, reducedMotion: false, dark: false })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  act(() => {
    root?.render(<LoadingSurface />)
  })

  expect(text(container, '[role="status"]')).toBe('Loading editor…')
  expect(one(container, '.editor-loading-spinner').getAttribute('aria-hidden')).toBe('true')
  expect(all(container, '.editor-loading-skeleton').length).toBeGreaterThan(1)
  expect(container.querySelector('.editor-loading-copy[aria-hidden="true"]')).not.toBeNull()
  expect(container.querySelector('.editor-loading-settings[aria-hidden="true"]')).not.toBeNull()
})
