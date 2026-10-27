import type { Locator, Page } from '@playwright/test'
import type { EditorState } from 'prosemirror-state'
import type { ComponentLocale } from '../src/contract'
import type { ApiService } from './http-fixtures'
import { expect } from '@playwright/test'
import { formattingCopy } from './editor-formatting-fixtures'
import { linkSelected, linkSelection } from './editor-link-remaining-fixtures'
import { selectInlineRange } from './editor-link-remaining-ui'

/**
 * The shortcut-guard probes: what the browser did with a real shortcut, and whether the editor,
 * its selection and its caret survived it. A synthetic key event would bypass the platform
 * default these cases exist to observe, so every probe here reads a real browser fact.
 */

export async function collapseLinkSelection(page: Page, body: Locator): Promise<void> {
  await selectInlineRange(page, body, linkSelection, linkSelected)
  // The native selection is only the input: ArrowRight has to act on a model range the editor
  // already owns, and the model has to end up collapsed, or the guard would test nothing.
  await expect.poll(async () => (await editorSelection(body)).empty).toBe(false)
  await page.keyboard.press('ArrowRight')
  await expect.poll(async () => (await editorSelection(body)).empty).toBe(true)
  await expect.poll(async () => await page.evaluate(() => window.getSelection()?.isCollapsed)).toBe(true)
}

async function editorSelection(body: Locator): Promise<{
  readonly from: number
  readonly to: number
  readonly empty: boolean
}> {
  return await body.evaluate((element) => {
    // eslint-disable-next-line ts/no-unsafe-type-assertion -- Read the live editor view from its host.
    const view = (element as HTMLElement & {
      editor?: { view: { state: EditorState } }
    }).editor?.view
    if (view === undefined) {
      throw new TypeError('The link fixture has no native editor view')
    }
    const { from, to, empty } = view.state.selection
    return { from, to, empty }
  })
}

async function domCaret(page: Page): Promise<{
  readonly anchorText: string
  readonly anchorOffset: number
  readonly focusText: string
  readonly focusOffset: number
}> {
  return await page.evaluate(() => {
    const selection = window.getSelection()
    if (selection === null || selection.anchorNode === null || selection.focusNode === null) {
      throw new TypeError('The link shortcut guard has no native caret')
    }
    return {
      anchorText: selection.anchorNode.textContent ?? '',
      anchorOffset: selection.anchorOffset,
      focusText: selection.focusNode.textContent ?? '',
      focusOffset: selection.focusOffset,
    }
  })
}

/** Keeps the real keydown so the case can read how the browser and the app left it. */
async function captureNativeShortcutEvent(body: Locator): Promise<void> {
  await body.evaluate(() => {
    const property = '__editorLinkShortcutKeydown'
    Object.defineProperty(window, property, {
      configurable: true,
      writable: true,
      value: undefined,
    })
    // Document capture: the case must see the browser's own keydown wherever focus sits, not only
    // when the editor body happens to hold it.
    document.addEventListener('keydown', (event) => {
      if (event instanceof KeyboardEvent && event.key.toLowerCase() === 'k'
        && (event.ctrlKey || event.metaKey)) {
        Object.defineProperty(window, property, {
          configurable: true,
          writable: true,
          value: event,
        })
      }
    }, true)
  })
}

async function nativeShortcutEvent(page: Page): Promise<{
  readonly key: string
  readonly control: boolean
  readonly meta: boolean
  readonly defaultPrevented: boolean
}> {
  return await page.evaluate(() => {
    const event: unknown = Reflect.get(window, '__editorLinkShortcutKeydown')
    if (!(event instanceof KeyboardEvent)) {
      throw new TypeError('The real link shortcut keydown was not captured')
    }
    return {
      key: event.key,
      control: event.ctrlKey,
      meta: event.metaKey,
      defaultPrevented: event.defaultPrevented,
    }
  })
}

/** Both real modifiers are cancelled without changing the document or selected range. */
export async function expectNoLinkCommand(
  page: Page,
  context: {
    readonly locale: ComponentLocale
    readonly body: Locator
    readonly api: ApiService
    readonly requireCollapsed?: boolean
  },
): Promise<void> {
  const { locale, body, api } = context
  const text = await body.textContent()
  const selection = await editorSelection(body)
  const caret = await domCaret(page)
  if (context.requireCollapsed ?? true) {
    expect(selection.empty).toBe(true)
    expect(caret.anchorText).toBe(caret.focusText)
    expect(caret.anchorOffset).toBe(caret.focusOffset)
  }
  else {
    expect(selection.empty).toBe(false)
    expect(await page.evaluate(() => window.getSelection()?.isCollapsed)).toBe(false)
  }
  await captureNativeShortcutEvent(body)
  for (const modifier of ['Control', 'Meta'] as const) {
    await page.keyboard.press(`${modifier}+k`)
    await expect(page.getByRole('dialog', { name: formattingCopy[locale].dialog, exact: true })).toHaveCount(0)
    await expect(page.getByRole('textbox', { name: formattingCopy[locale].url, exact: true })).toHaveCount(0)
    const event = await nativeShortcutEvent(page)
    expect(event.key).toBe('k')
    expect(event.control).toBe(modifier === 'Control')
    expect(event.meta).toBe(modifier === 'Meta')
    // Measured on both engines: the editor cancels the chord on a collapsed caret, so the
    // platform's own text-editing default never runs. What the guard proves is that nothing else
    // happened either: no editor, no destination field, no write, and text, caret and model
    // selection untouched.
    expect(event.defaultPrevented).toBe(true)
    expect(await editorSelection(body)).toEqual(selection)
    expect(await domCaret(page)).toEqual(caret)
    expect(await body.textContent()).toBe(text)
    expect(api.calls.filter(call => call.method === 'PUT')).toEqual([])
  }
}
