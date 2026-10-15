import type { KeyboardEvent } from 'react'

export function loopDrawerOptionTab(event: KeyboardEvent<HTMLDivElement>): void {
  if (event.key !== 'Tab' || !event.altKey || event.ctrlKey || event.metaKey) {
    return
  }
  // Safari's Option+Tab visits controls, while Radix only loops an unmodified Tab.
  const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
    'button:not([disabled]):not([aria-disabled=true]):not([tabindex="-1"]), '
    + 'input:not([disabled]), textarea:not([disabled]), a[href]',
  )).filter(element => element.getClientRects().length > 0)
  const first = controls.at(0)
  const last = controls.at(-1)
  if (event.target === (event.shiftKey ? first : last)) {
    event.preventDefault()
    const target = event.shiftKey ? last : first
    target?.focus({ preventScroll: true })
  }
}
