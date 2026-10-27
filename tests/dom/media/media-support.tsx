import type { FrontendPreferences } from '@/components/ui/ztd-me'
import type { MediaAsset, MediaRole } from '@/features/media/media-types'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { createPreferencePolicy } from '@/components/ui/ztd-me'
import { assetDescriptorSchema } from '@/contracts/media'
import { GallerySession } from '@/features/media/gallery-session'
import { MediaManager } from '@/features/media/media'
import { BlogFrontend } from '@/i18n/frontend'
import { installBrowserShims, setMediaState } from '~/tests/dom/shared/environment'
import { serveFetch } from '~/tests/dom/shared/http'

const owner = 'media-dom-owner'
const csrfToken = 'media-dom-csrf'
const mounted: Array<() => void> = []

export function mediaAsset(input: {
  assetId: string
  filename: string
  role: MediaRole
  type: string
  bytes: number
}): MediaAsset {
  return assetDescriptorSchema.parse({
    ...input,
    state: 'ready',
    url: `/assets/${input.assetId}`,
    sha256: '0'.repeat(64),
  })
}

export function mediaGalleryHandlers(options: { listing: () => MediaAsset[] }): Parameters<typeof serveFetch>[0] {
  return {
    'GET /api/admin/session': () => ({ body: { ownerSub: owner, csrfToken } }),
    'GET /api/admin/assets': () => ({ body: { items: options.listing(), nextCursor: null } }),
  }
}

/** Render the real gallery; no upload, FileList or editor workspace stand-ins. */
export function mountMediaGallery(
  handlers: Parameters<typeof serveFetch>[0],
  options: { width: number, locale: 'en' | 'zh-CN', mode: 'light' | 'dark' },
): { container: HTMLElement, session: GallerySession, api: ReturnType<typeof serveFetch> } {
  installBrowserShims()
  setMediaState({ width: options.width, dark: options.mode === 'dark', reducedMotion: false })
  const api = serveFetch(handlers)
  const session = new GallerySession(owner, csrfToken)
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const policy = createPreferencePolicy({ name: 'blog.dom.media.v1', secure: false })
  const initialPreferences: FrontendPreferences = {
    version: 1,
    mode: options.mode,
    palette: 'neutral',
    locale: options.locale,
  }
  act(() => {
    root.render(
      <BlogFrontend initialPreferences={initialPreferences} policy={policy}>
        <MediaManager session={session} retry={async () => await session.load()} />
      </BlogFrontend>,
    )
  })
  mounted.push(() => {
    act(() => root.unmount())
    container.remove()
    session.dispose()
    api.dispose()
  })
  return { container, session, api }
}

export function resetMediaDom(): void {
  for (const unmount of mounted.splice(0)) {
    unmount()
  }
}
