import type { ReactNode } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DocumentReader } from '@/features/reader/document'
import { MediaExpiryRefresh } from '@/features/reader/media-expiry-refresh'
import { PostFeed } from '@/features/reader/post-feed'
import { installBrowserShims } from '~/tests/dom/shared/environment'
import { mountPublic } from '../shell/public-support'
import { pageFixture, publicItem } from './notion-fixture'

const { refresh, router } = vi.hoisted(() => {
  const refreshPage = vi.fn()
  return { refresh: refreshPage, router: { refresh: refreshPage } }
})
vi.mock('next/navigation', async importOriginal => ({
  ...await importOriginal<typeof import('next/link')>(),
  useRouter: () => router,
}))

let unmount: (() => void) | undefined
const now = Date.UTC(2026, 10, 13)

function mount(children: ReactNode): { readonly render: (children: ReactNode) => void } {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const render = (content: ReactNode): void => {
    act(() => {
      root.render(content)
    })
  }
  render(children)
  unmount = () => {
    act(() => {
      root.unmount()
    })
    container.remove()
  }
  return { render }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(now)
  refresh.mockClear()
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
})
afterEach(() => {
  unmount?.()
  unmount = undefined
  vi.useRealTimers()
})

it('refreshes before expiry once and rearms only when expiry changes', () => {
  const view = mount(<MediaExpiryRefresh expiresAt={now + 120_000} />)
  act(() => {
    vi.advanceTimersByTime(59_999)
  })
  expect(refresh).not.toHaveBeenCalled()
  act(() => {
    vi.advanceTimersByTime(1)
  })
  expect(refresh).toHaveBeenCalledTimes(1)
  view.render(<MediaExpiryRefresh expiresAt={now + 120_000} />)
  act(() => {
    window.dispatchEvent(new Event('focus'))
  })
  expect(refresh).toHaveBeenCalledTimes(1)
  view.render(<MediaExpiryRefresh expiresAt={now + 240_000} />)
  act(() => {
    vi.advanceTimersByTime(120_000)
  })
  expect(refresh).toHaveBeenCalledTimes(2)
})

it('refreshes an expired hidden tab when it becomes visible', () => {
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  mount(<MediaExpiryRefresh expiresAt={now + 120_000} />)
  act(() => {
    vi.advanceTimersByTime(180_000)
  })
  expect(refresh).not.toHaveBeenCalled()
  visibility.mockReturnValue('visible')
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
  expect(refresh).toHaveBeenCalledTimes(1)
  act(() => {
    window.dispatchEvent(new Event('pageshow'))
  })
  expect(refresh).toHaveBeenCalledTimes(1)
})

it('cleans timers and resume listeners on unmount', () => {
  mount(<MediaExpiryRefresh expiresAt={now + 120_000} />)
  unmount?.()
  unmount = undefined
  expect(vi.getTimerCount()).toBe(0)
  act(() => {
    vi.advanceTimersByTime(180_000)
    window.dispatchEvent(new Event('focus'))
    window.dispatchEvent(new Event('pageshow'))
    document.dispatchEvent(new Event('visibilitychange'))
  })
  expect(refresh).not.toHaveBeenCalled()
})

it('leaves permanent media unscheduled', () => {
  mount(<MediaExpiryRefresh expiresAt={null} />)
  expect(vi.getTimerCount()).toBe(0)
  act(() => {
    window.dispatchEvent(new Event('focus'))
  })
  expect(refresh).not.toHaveBeenCalled()
})

for (const surface of [
  'feed',
  'article cover',
  'article body',
] as const) {
  it(`${surface} refreshes before its earliest signed media expiry`, () => {
    installBrowserShims()
    const item = publicItem({
      cover: {
        url: 'https://media.example/cover.jpg',
        expiresAt: now + (surface === 'article body' ? 180_000 : 120_000),
      },
    })
    const page = {
      ...pageFixture(),
      item,
      mediaExpiresAt: now + (surface === 'article body' ? 120_000 : 180_000),
    }
    const view = mountPublic(surface === 'feed' ? <PostFeed items={[item]} /> : <DocumentReader page={page} />)
    unmount = view.unmount
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(refresh).toHaveBeenCalledTimes(1)
  })
}
