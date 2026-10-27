import { act } from 'react'
import { afterEach, vi } from 'vitest'

type MediaState = {
  width: number
  reducedMotion: boolean
  dark: boolean
}

const media: MediaState = { width: 1440, reducedMotion: false, dark: false }
const scrollIntoView = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView')

afterEach(() => {
  if (scrollIntoView === undefined) {
    Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
  }
  else {
    Object.defineProperty(Element.prototype, 'scrollIntoView', scrollIntoView)
  }
})

/** Fixed host preferences for rendering, not a viewport or layout simulation. */
export function setMediaState(next: Partial<MediaState>): void {
  Object.assign(media, next)
}

/** Only missing preference and observation APIs, with no geometry simulation. */
export function installBrowserShims(): void {
  vi.stubGlobal('matchMedia', (query: string): MediaQueryList => {
    const width = /^\((min|max)-width:\s*(\d+)px\)$/.exec(query)
    let matches = false
    if (width !== null) {
      matches = width[1] === 'max' ? media.width <= Number(width[2]) : media.width >= Number(width[2])
    }
    else if (query === '(prefers-color-scheme: dark)') {
      matches = media.dark
    }
    else if (query === '(prefers-reduced-motion: reduce)') {
      matches = media.reducedMotion
    }
    return {
      media: query,
      matches,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }
  })
  vi.stubGlobal('ResizeObserver', class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  })
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    value: () => {},
  })
}

export async function drainHostTask(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0)
    })
  })
}

/** Let Vitest own waiting rather than a custom observer/deadline engine. */
export async function until(condition: () => boolean): Promise<void> {
  await vi.waitFor(() => {
    if (!condition()) {
      throw new Error('The expected DOM state has not rendered')
    }
  })
}
