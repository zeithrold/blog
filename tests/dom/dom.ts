import { act } from 'react'

/*
 * Queries and interactions for the DOM layer. Everything here reads rendered
 * output or dispatches the event a browser would dispatch; nothing computes an
 * expected value, decides a branch or stands in for the accessibility tree.
 *
 * `field` and `button` match a name the way a case reads it: `aria-label`, then
 * `aria-labelledby`, then an associated `<label>`, then visible text. That is a
 * query convenience, never an accessibility proof — an axe scan and a real
 * accessibility tree stay in the browser layers.
 */

const controls = 'input, textarea, select, [role="combobox"], [role="textbox"]'

function collapse(value: string | null): string {
  return (value ?? '').replaceAll(/\s+/g, ' ').trim()
}

function unique<T extends Element>(found: T[], description: string): T {
  const [first] = found
  if (found.length !== 1 || first === undefined) {
    throw new Error(`Expected one ${description}, found ${found.length}`)
  }
  return first
}

export function all<T extends Element = HTMLElement>(root: ParentNode, selector: string): T[] {
  return Array.from(root.querySelectorAll<T>(selector))
}

export function one<T extends Element = HTMLElement>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector)
  if (element === null) {
    throw new Error(`No element matched ${selector}`)
  }
  return element
}

export function text(root: ParentNode, selector: string): string {
  return collapse(one(root, selector).textContent)
}

export function texts(root: ParentNode, selector: string): string[] {
  return all(root, selector).map(element => collapse(element.textContent))
}

/** The visible or declared name of one control, read the way a case states it. */
function nameOf(element: Element): string {
  const label = element.getAttribute('aria-label')
  if (label !== null && label.trim() !== '') {
    return collapse(label)
  }
  const labelledBy = element.getAttribute('aria-labelledby')
  if (labelledBy !== null) {
    const referenced = labelledBy.split(/\s+/)
      .map(id => element.ownerDocument.getElementById(id)?.textContent ?? '')
    const joined = collapse(referenced.join(' '))
    if (joined !== '') {
      return joined
    }
  }
  const id = element.getAttribute('id')
  if (id !== null) {
    const labels = Array.from(element.ownerDocument.querySelectorAll(`label[for="${id}"]`))
    const joined = collapse(labels.map(entry => entry.textContent).join(' '))
    if (joined !== '') {
      return joined
    }
  }
  const wrapping = element.closest('label')
  if (wrapping !== null) {
    return collapse(wrapping.textContent)
  }
  return collapse(element.textContent)
}

/** A form control whose name is exactly `label`; ambiguity fails the case. */
export function field(root: ParentNode, label: string): HTMLElement {
  const found = all(root, controls).filter(element => nameOf(element) === collapse(label))
  return unique(found, `"${label}" field`)
}

/** A button whose visible text is exactly `label`; ambiguity fails the case. */
export function button(root: ParentNode, label: string): HTMLButtonElement {
  const found = all<HTMLButtonElement>(root, 'button')
    .filter(element => collapse(element.textContent) === collapse(label))
  return unique(found, `"${label}" button`)
}

/** Any element whose visible text contains `needle`, unique. */
export function containing(root: ParentNode, selector: string, needle: string): HTMLElement {
  const found = all(root, selector).filter(element => collapse(element.textContent).includes(needle))
  return unique(found, `element containing "${needle}"`)
}

/** Dispatches the click a browser would; callers wrap it in `act`. */
export function click(element: Element): void {
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
}

export function press(element: Element, key: string): void {
  act(() => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
    element.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }))
  })
}

/** Writes a controlled field the way an input event carries a value. */
export function typeText(input: HTMLElement, value: string): void {
  const prototype = input instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.bind(input)
  setter?.(value)
  act(() => {
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

/** Chooses an item of a native `<select>`; Radix selects use `openCombobox`. */
export function selectNative(select: HTMLSelectElement, value: string): void {
  select.value = value
  act(() => {
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

export function combobox(root: ParentNode, label: string): HTMLElement {
  const found = all(root, '[role="combobox"]').filter(element => nameOf(element) === collapse(label))
  return unique(found, `"${label}" combobox`)
}

/** The event the production combobox opens on: a real keyboard event. */
export function openCombobox(element: HTMLElement): void {
  press(element, 'ArrowDown')
}

export function option(root: ParentNode, needle: string): HTMLElement {
  const found = all(root, '[role="option"]')
    .filter(element => collapse(element.textContent).includes(needle))
  return unique(found, `option containing "${needle}"`)
}
