import type { Page } from '@playwright/test'

declare global {
  // eslint-disable-next-line ts/consistent-type-definitions -- Browser probe augments the global Window interface.
  interface Window {
    overlayCloseProbe: { count: () => number, release: (reverse?: boolean) => void }
  }
}

export async function deferOverlayClose(page: Page, selector: string): Promise<void> {
  await page.evaluate(installCloseProbe, selector)
}

// Delay application close-focus listeners while letting the real FocusScope
// cleanup finish. This controls callback timing, not physical click timing.
function installCloseProbe(selector: string): void {
  const kind = 'focusScope.autoFocusOnUnmount'
  // Native methods are always invoked with their original target via call().
  // eslint-disable-next-line ts/unbound-method -- Invoked with the event target through call().
  const dispatch = EventTarget.prototype.dispatchEvent
  // eslint-disable-next-line ts/unbound-method -- Invoked with the event target through call().
  const remove = EventTarget.prototype.removeEventListener
  const pending: { target: EventTarget, event: Event, removals: (() => void)[] }[] = []
  let active = true
  EventTarget.prototype.dispatchEvent = function (event): boolean {
    if (active && event.type === kind && this instanceof HTMLElement && this.matches(selector)) {
      event.preventDefault()
      pending.push({ target: this, event, removals: [] })
      return true
    }
    return dispatch.call(this, event)
  }
  EventTarget.prototype.removeEventListener = function (type, listener, options): void {
    const held = type === kind ? pending.findLast(entry => entry.target === this) : undefined
    if (held !== undefined) {
      held.removals.push(() => remove.call(this, type, listener, options))
    }
    else { remove.call(this, type, listener, options) }
  }
  window.overlayCloseProbe = {
    count: () => pending.length,
    release: (reverse = false) => {
      active = false
      const entries = pending.splice(0)
      if (reverse) {
        entries.reverse()
      }
      for (const entry of entries) {
        dispatch.call(entry.target, entry.event)
        entry.removals.forEach((cleanup) => {
          cleanup()
        })
      }
    },
  }
}
