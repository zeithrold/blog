import { act } from 'react'
import { vi } from 'vitest'

/** jsdom has no layout or media engine; the pilot asserts state and DOM only. */
export function installBrowserShims(): void {
  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })
  }
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
}

export function combobox(root: ParentNode, label: string): HTMLElement {
  const element = root.querySelector<HTMLElement>(`[role="combobox"][aria-label="${label}"]`)
  if (element === null) {
    throw new Error(`No combobox named ${label}`)
  }
  return element
}

export function openCombobox(element: HTMLElement): void {
  act(() => {
    element.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    }))
  })
}

export function typeText(input: HTMLElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
    ?.set
    ?.bind(input)
  setter?.(value)
  act(() => {
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

/** The pending-plan badge the real ScheduledStatus renders. */
export function scheduledBadge(container: ParentNode): boolean {
  return Array.from(container.querySelectorAll('[data-slot="badge"][title]'))
    .some(badge => badge.textContent.trim() === 'Scheduled')
}

export function cancelControls(container: ParentNode): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll('button'))
    .filter(element => element.textContent.trim() === 'Cancel schedule')
}

export function option(root: ParentNode, needle: string): HTMLElement {
  const element = Array.from(root.querySelectorAll<HTMLElement>('[role="option"]'))
    .find(candidate => candidate.textContent.includes(needle))
  if (element === undefined) {
    throw new Error(`No option containing ${needle}`)
  }
  return element
}

/*
 * DOM assertions and scheduling for the publication pilot. Nothing here reads a
 * product model: the helpers only query rendered output or advance timers the
 * production code installed.
 */

/** A button whose visible text is exactly `label`; ambiguity fails the case. */
export function button(root: ParentNode, label: string): HTMLButtonElement {
  const matches = Array.from(root.querySelectorAll('button'))
    .filter(element => element.textContent.trim() === label)
  const [first] = matches
  if (matches.length !== 1 || first === undefined) {
    throw new Error(`Expected one "${label}" button, found ${matches.length}`)
  }
  return first
}

/** Dispatches the click a browser would; callers wrap it in `act`. */
export function click(element: Element): void {
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
}

export function texts(root: ParentNode, selector: string): string[] {
  return Array.from(root.querySelectorAll(selector))
    .map(element => element.textContent.trim())
}

export function text(root: ParentNode, selector: string): string {
  const element = root.querySelector(selector)
  if (element === null) {
    throw new Error(`No element matched ${selector}`)
  }
  return element.textContent.trim()
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

/** Waits for a DOM condition without timers: the render itself is the signal. */
export async function until(condition: () => boolean): Promise<void> {
  if (condition()) {
    return
  }
  await new Promise<void>((resolve) => {
    const observer = new MutationObserver(() => {
      if (condition()) {
        observer.disconnect()
        resolve()
      }
    })
    observer.observe(document.body, { subtree: true, childList: true, characterData: true })
  })
}
