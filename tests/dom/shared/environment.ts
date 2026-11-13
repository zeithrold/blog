import { afterEach, vi } from 'vitest'

const originalScroll = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView')

afterEach(() => {
  if (originalScroll === undefined) {
    Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
  }
  else {
    Object.defineProperty(Element.prototype, 'scrollIntoView', originalScroll)
  }
})

/** Missing browser APIs only; jsdom does not establish rendered geometry. */
export function installBrowserShims(): void {
  vi.stubGlobal('matchMedia', (query: string): MediaQueryList => {
    const width = /^\((min|max)-width:\s*(\d+)px\)$/.exec(query)
    const matches = width !== null
      && (width[1] === 'max' ? Number(width[2]) >= 1440 : Number(width[2]) <= 1440)
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
