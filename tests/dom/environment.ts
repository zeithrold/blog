import { act } from 'react'
import { vi } from 'vitest'

/*
 * The jsdom host the DOM layer declares, not a substitute for a product rule.
 *
 * jsdom has a document, React and the real modules, and no layout, media engine,
 * pointer capture or scroll. Everything here supplies the host fact a real
 * component reads — a viewport width, a media query answer, a pointer capture
 * call — and nothing here answers for a component, hook, policy or request.
 * Measured geometry, painted size, computed styles, axe, native focus delivery
 * and scrolling stay in a browser layer; no helper here may imply them.
 *
 * Two boundaries this module states rather than hides:
 * - A media query it cannot answer is `false`. `(max-width: Npx)`, `(min-width:
 *   Npx)`, reduced motion and colour scheme are the only queries this host
 *   answers; any other query reads as false and proves nothing about a browser.
 * - `until` waits for a real render to commit and then fails. It is not a retry
 *   loop for an assertion, and it never turns a repeated click, a repeated
 *   keystroke or a swallowed error into a pass.
 */

export type MediaState = {
  /** The viewport width the host reports to media queries. */
  readonly width: number
  readonly reducedMotion: boolean
  readonly dark: boolean
}

type MediaListener = (event: MediaQueryListEvent) => void

/** A media query callback, as the legacy `addListener` hands one over. */
type MediaCallback = (this: MediaQueryList, event: MediaQueryListEvent) => void

/** What a component may hand to `addEventListener` or the legacy `addListener`. */
type HostListener = EventListenerOrEventListenerObject | MediaCallback

type QueryRecord = {
  matches: boolean
  /** Keyed by the listener the component registered, so removal is identity-exact. */
  readonly listeners: Map<HostListener, MediaListener>
}

const host: MediaState = { width: 1440, reducedMotion: false, dark: false }
const queries = new Map<string, QueryRecord>()
const widthQuery = /^\(\s*(min|max)-width:\s*(\d+(?:\.\d+)?)px\s*\)$/

/** The host facts this viewport stands for; a query it cannot answer is false. */
function evaluate(query: string): boolean {
  const bounded = widthQuery.exec(query.trim())
  if (bounded !== null) {
    const limit = Number(bounded[2])
    return bounded[1] === 'max' ? host.width <= limit : host.width >= limit
  }
  switch (query.trim()) {
    case '(prefers-reduced-motion: reduce)': { return host.reducedMotion }
    case '(prefers-reduced-motion: no-preference)': { return !host.reducedMotion }
    case '(prefers-color-scheme: dark)': { return host.dark }
    case '(prefers-color-scheme: light)': { return !host.dark }
    default: { return false }
  }
}

function record(query: string): QueryRecord {
  const known = queries.get(query)
  if (known !== undefined) {
    return known
  }
  const created: QueryRecord = { matches: evaluate(query), listeners: new Map() }
  queries.set(query, created)
  return created
}

/**
 * One shared list per query, so a component that subscribes and a component that
 * re-reads `matches` observe the same host state. `matches` is evaluated when it
 * is read, exactly as a media query answers the current viewport.
 */
function mediaQueryList(query: string): MediaQueryList {
  const current = record(query)
  const subscribe = (type: string, listener: HostListener): void => {
    if (type !== 'change' || current.listeners.has(listener)) {
      return
    }
    current.listeners.set(listener, (event) => {
      if (typeof listener === 'function') {
        // The listener may declare a MediaQueryList `this`; it never reads one here.
        Reflect.apply(listener, undefined, [event])
        return
      }
      listener.handleEvent(event)
    })
  }
  const list: MediaQueryList = {
    media: query,
    get matches(): boolean {
      return evaluate(query)
    },
    onchange: null,
    addEventListener: subscribe,
    removeEventListener: (type: string, listener: HostListener): void => {
      if (type === 'change') {
        current.listeners.delete(listener)
      }
    },
    addListener: (listener): void => {
      if (listener !== null) {
        subscribe('change', listener)
      }
    },
    removeListener: (listener): void => {
      if (listener !== null) {
        current.listeners.delete(listener)
      }
    },
    dispatchEvent: (): boolean => false,
  }
  return list
}

/**
 * Declares the host viewport for the components under test. This answers the
 * media query a real hook asks; it does not choose a compact branch, a layout or
 * a policy, and it measures nothing.
 */
export function setMediaState(next: Partial<MediaState>): void {
  Object.assign(host, next)
  act(() => {
    for (const [query, current] of queries) {
      const matches = evaluate(query)
      if (matches === current.matches) {
        continue
      }
      current.matches = matches
      for (const listener of current.listeners.values()) {
        listener(Object.assign(new Event('change'), { matches, media: query }))
      }
    }
  })
}

/**
 * No layout engine: every rect is zero, so a case that needs geometry cannot be
 * written against this layer. Pointer capture and scroll are no-ops that keep a
 * real Radix interaction mountable.
 */
export function installBrowserShims(): void {
  window.matchMedia = (query: string): MediaQueryList => mediaQueryList(query)
  if (typeof globalThis.ResizeObserver !== 'function') {
    class ResizeObserverShim {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    globalThis.ResizeObserver = ResizeObserverShim
  }
  if (typeof Element.prototype.scrollIntoView !== 'function') {
    Element.prototype.scrollIntoView = () => {}
  }
  if (typeof Element.prototype.setPointerCapture !== 'function') {
    Element.prototype.setPointerCapture = () => {}
  }
  if (typeof Element.prototype.releasePointerCapture !== 'function') {
    Element.prototype.releasePointerCapture = () => {}
  }
  if (typeof Element.prototype.hasPointerCapture !== 'function') {
    Element.prototype.hasPointerCapture = () => false
  }
}

/** Lets React commit the work an event started; a 0ms host task, not a delay. */
export async function drainHostTask(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0)
    })
  })
}

/** Advances the production timers under test (for example the 2s autosave). */
export async function advance(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

/**
 * Waits for a DOM condition without timers: the render itself is the signal. A
 * condition that never holds fails with its own message instead of hanging.
 *
 * This is a wait for asynchronous completion, never a retry of an assertion: a
 * case whose expectation does not hold must fail, so a condition that is still
 * false at the deadline is an error, not another attempt.
 *
 * It finishes exactly once. The deadline is cleared and the observer detached on
 * the path that wins, a condition that throws rejects instead of resolving, and
 * attribute-only changes are observed — a class or `aria-*` update is a real
 * commit, and a stale deadline must never fire a condition into the next case.
 */
export async function until(condition: () => boolean, timeout = 4000): Promise<void> {
  if (condition()) {
    return
  }
  await new Promise<void>((resolve, reject) => {
    let finished = false
    let deadline: ReturnType<typeof setTimeout> | null = null
    let detach: () => void = () => {}
    function finish(error?: Error): void {
      if (finished) {
        return
      }
      finished = true
      detach()
      if (deadline !== null) {
        clearTimeout(deadline)
      }
      if (error === undefined) {
        resolve()
        return
      }
      reject(error)
    }
    function check(): void {
      if (finished) {
        return
      }
      let holds: boolean
      try {
        holds = condition()
      }
      catch (error: unknown) {
        finish(error instanceof Error ? error : new Error('The DOM condition threw a non-error value'))
        return
      }
      if (holds) {
        finish()
      }
    }
    const observer = new MutationObserver(() => {
      check()
    })
    detach = () => {
      observer.disconnect()
    }
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
    })
    deadline = setTimeout(() => {
      finish(new Error('The DOM state this case waits for never rendered'))
    }, timeout)
    check()
  })
}
