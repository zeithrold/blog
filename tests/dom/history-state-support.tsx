import type { ReactElement } from 'react'
import type { HistoryPageProps } from '@/features/history/history-page-model'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { createPreferencePolicy, resolveInitialPreferences } from '@/components/ui/ztd-me'
import { HistoryPage } from '@/features/history/history-page'
import { BlogFrontend } from '@/i18n/frontend'
import { resetDomPilot } from './history-page-support'

/**
 * The history page itself in jsdom: the real page, the real translations, the
 * real hook, client and schemas, with only `fetch` replaced by a case's table.
 *
 * The page is mounted where the server route mounts it, inside the product's own
 * `BlogFrontend`, with the preferences the layout resolves from the request. What
 * the page says, which controls it refuses and what it writes are proved here.
 * Geometry, native focus order, IME and BlockNote are absent by design and stay
 * browser checks; nothing in this module measures layout.
 */

export type PageLocale = 'en' | 'zh-CN'

// jsdom implements neither layout observation nor pointer capture, and Radix
// reads both when a menu opens. These stubs keep the components mountable; they
// observe nothing and no assertion reads them.
installMissingBrowserApis()
function installMissingBrowserApis(): void {
  defineMissing(globalThis, 'ResizeObserver', class {
    observe(): void { /* jsdom has no layout to observe */ }
    unobserve(): void { /* jsdom has no layout to observe */ }
    disconnect(): void { /* jsdom has no layout to observe */ }
  })
  defineMissing(Element.prototype, 'scrollIntoView', (): void => {
    /* jsdom has no scrolling */
  })
  defineMissing(Element.prototype, 'hasPointerCapture', (): boolean => false)
  defineMissing(Element.prototype, 'setPointerCapture', (): void => { /* jsdom has no pointer */ })
  defineMissing(Element.prototype, 'releasePointerCapture', (): void => { /* jsdom has no pointer */ })
  // The preference store asks the host for its colour scheme; jsdom answers none.
  defineMissing(window, 'matchMedia', (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: (): void => { /* no media changes in jsdom */ },
    removeEventListener: (): void => { /* no media changes in jsdom */ },
    addListener: (): void => { /* no media changes in jsdom */ },
    removeListener: (): void => { /* no media changes in jsdom */ },
    dispatchEvent: (): boolean => false,
  }))
}

/** Installs one browser API jsdom does not implement, leaving an existing one alone. */
function defineMissing(target: object, name: string, value: unknown): void {
  // jsdom declares some of these names and leaves them undefined, so the value,
  // not the key, decides whether the host already answers.
  const existing: unknown = Reflect.get(target, name)
  if (existing !== undefined) {
    return
  }
  Object.defineProperty(target, name, { value, configurable: true, writable: true })
}

export type Surface = {
  /** The element the surface is mounted into; dialogs render into `document.body`. */
  readonly container: HTMLElement
  /** Every character the surface renders, for identifier and copy assertions. */
  readonly text: () => string
  /** Any button on the surface, by accessible name; dialogs render into `document.body`. */
  readonly button: (name: string | RegExp) => HTMLButtonElement
  readonly unmount: () => void
}

export type PageView = Surface & {
  /** A Radix select trigger, found by its accessible name. */
  readonly combobox: (name: string) => HTMLButtonElement
  readonly alert: () => HTMLElement | null
  readonly statuses: () => string[]
}

const rendered: Surface[] = []

// The policy only names the preference store and never persists here, so the DOM
// mount keeps its own name instead of copying the layout's private constant.
const policy = createPreferencePolicy({ name: 'ztd.blog.dom-tests.ui', secure: false })

/** Mounts real product UI inside the product's own frontend providers. */
export function renderElement(element: ReactElement, locale: PageLocale = 'en'): Surface {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const initialPreferences = resolveInitialPreferences({ policy, acceptLanguage: locale })
  act(() => {
    root.render(
      <BlogFrontend initialPreferences={initialPreferences} policy={policy}>
        {element}
      </BlogFrontend>,
    )
  })
  const surface: Surface = {
    container,
    text: () => textOf(container),
    button: name => findButton(name),
    unmount: () => {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
  rendered.push(surface)
  return surface
}

/** Mounts the unmodified history page and adds its page-wide queries. */
export function renderPage(props: HistoryPageProps, locale: PageLocale = 'en'): PageView {
  const surface = renderElement(<HistoryPage {...props} />, locale)
  return {
    ...surface,
    combobox: name => findCombobox(name),
    alert: () => document.querySelector('[role="alert"]'),
    statuses: () => Array.from(document.querySelectorAll('[role="status"]')).map(item => textOf(item)),
  }
}

/** One event loop turn inside `act`, so React commits what the case triggered. */
async function flush(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0)
    })
  })
}

/**
 * A real click, so a `disabled` control dispatches nothing at all: a case that
 * expects a refusal cannot be served by the handler of a control that was in
 * fact enabled.
 */
export async function click(element: Element): Promise<void> {
  if (!(element instanceof HTMLElement)) {
    throw new TypeError(`Cannot click ${element.nodeName}: it is not an element`)
  }
  act(() => {
    element.click()
  })
  await flush()
}

/**
 * A real keydown on `element`, or on whatever currently holds focus.
 *
 * A select is operated here the way a reader operates it: `ArrowDown` to open and
 * move, `Enter` to commit. jsdom proves the state that follows, not the menu's
 * geometry, the native key delivery or the focus order.
 */
export async function pressKey(name: string, element: Element | null = null): Promise<void> {
  const target = element ?? document.activeElement ?? document.body
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }))
  })
  await flush()
}

/** Every character an element renders, with whitespace collapsed as a reader sees it. */
export function visibleText(element: Element | null): string {
  return element === null ? '' : textOf(element)
}

/** The revision the page compares *to*, as its own selection state records it. */
export function selectedRevision(view: PageView): string | null {
  return view.container.querySelector('[data-selected-revision]')?.getAttribute('data-selected-revision') ?? null
}

/** The document title the page claims to be looking at. */
export function headerTitle(view: PageView): string {
  return visibleText(view.container.querySelector('header p'))
}

/** The saved revisions the sidebar lists, newest first. */
export function revisionRows(view: PageView): string[] {
  return Array.from(view.container.querySelectorAll('.history-revision'), row => visibleText(row))
}

/** The reasons a revision cannot be published, when the page shows them at all. */
export function requirements(view: PageView): string[] | null {
  const list = view.container.querySelector('.history-publication-requirements')
  if (list === null) {
    return null
  }
  return Array.from(list.querySelectorAll('li'), item => visibleText(item))
}

/** Unmounts every page this file mounted, then runs the pilot's own teardown. */
export function resetDomPage(): void {
  try {
    for (const view of rendered.splice(0)) {
      view.unmount()
    }
  }
  finally {
    resetDomPilot()
  }
}

function textOf(element: Element): string {
  return readableText(element).replace(/\s+/g, ' ').trim()
}

/**
 * The characters a reader sees, with a separator wherever an element boundary
 * splits them. `textContent` alone glues a revision number to the badge that
 * follows it; a reader reads two words.
 */
function readableText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.nodeValue ?? ''
  }
  if (!(node instanceof Element)) {
    return ''
  }
  // Radix renders a stylesheet inside its scroll area; stylesheet source is not page text.
  if (node.tagName === 'STYLE' || node.tagName === 'SCRIPT') {
    return ''
  }
  return Array.from(node.childNodes, child => readableText(child)).join(' ')
}

function findButton(name: string | RegExp): HTMLButtonElement {
  const buttons = Array.from(document.querySelectorAll('button'))
  const found = buttons.find(button => matches(nameOf(button), name))
  if (found === undefined) {
    throw new Error(`No button named ${String(name)}. Rendered: ${names(buttons)}`)
  }
  return found
}

function findCombobox(name: string): HTMLButtonElement {
  const found = document.querySelector(`[role="combobox"][aria-label="${name}"]`)
  if (!(found instanceof HTMLButtonElement)) {
    const listed = names(document.querySelectorAll('[role="combobox"]'))
    throw new TypeError(`No combobox labelled ${name}. Rendered: ${listed}`)
  }
  return found
}

function nameOf(element: Element): string {
  return (element.getAttribute('aria-label') ?? textOf(element)).replace(/\s+/g, ' ').trim()
}

function matches(value: string, name: string | RegExp): boolean {
  return typeof name === 'string' ? value === name : name.test(value)
}

function names(elements: Iterable<Element>): string {
  return Array.from(elements, element => JSON.stringify(nameOf(element))).join(', ')
}
