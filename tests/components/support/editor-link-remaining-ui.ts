import type { Locator, Page } from '@playwright/test'
import type { EditorState, Transaction } from 'prosemirror-state'
import type { ComponentLocale } from '../src/contract'
import type { ApiService } from './http-fixtures'
import { expect } from '@playwright/test'
import { horizontalBounds } from '~/tests/support/browser/layout'
import { expectPacketContent, formattingCopy, linkUrl, openLinkEntry } from './editor-formatting-fixtures'
import {
  adjacentText,
  charactersOf,
  charactersWithLink,
  editedLinkContent,
  expectPacketCharacters,
  expectPacketUnlinked,
  linkedContent,
  linkSelected,
  nextLink,
  oldLink,
  replacementLink,
  unlinkedEditedContent,
} from './editor-link-remaining-fixtures'

/** Selects a range across the inline nodes the way a pointer drag or Shift+Arrow leaves it. */
export async function selectInlineRange(
  page: Page,
  body: Locator,
  range: { readonly start: number, readonly end: number },
  expected: string,
): Promise<void> {
  await body.focus()
  await body.evaluate(async (element, offsets) => {
    await document.fonts.ready
    const inlineContent = element.querySelector('.bn-inline-content')
    if (inlineContent === null) {
      throw new Error('The link fixture has no inline paragraph')
    }
    const walker = document.createTreeWalker(inlineContent, NodeFilter.SHOW_TEXT)
    const point = (offset: number): { node: Node, offset: number } => {
      walker.currentNode = inlineContent
      let node = walker.nextNode()
      while (node !== null) {
        const length = node.textContent?.length ?? 0
        if (offset <= length) {
          return { node, offset }
        }
        offset -= length
        node = walker.nextNode()
      }
      throw new Error('Selection exceeds the paragraph')
    }
    const start = point(offsets.start)
    const end = point(offsets.end)
    window.getSelection()?.setBaseAndExtent(start.node, start.offset, end.node, end.offset)
    document.dispatchEvent(new Event('selectionchange'))
  }, range)
  await expect.poll(async () => await page.evaluate(() => window.getSelection()?.toString())).toBe(expected)
  if (await body.getAttribute('contenteditable') !== 'false') {
    // Wait for the native selection state and its desktop effects before a shortcut.
    await expect(page.locator('.bn-formatting-toolbar')).toBeVisible()
  }
}

export async function expectSelectionRestored(page: Page, body: Locator): Promise<void> {
  await expect(body).toBeFocused()
  await expect.poll(async () => await page.evaluate(() => window.getSelection()?.toString())).toBe(linkSelected)
}

/** Presses one modifier of the platform shortcut and waits for the settled editor. */
export async function openShortcutLink(
  page: Page,
  locale: ComponentLocale,
  modifier: 'Control' | 'Meta',
): Promise<Locator> {
  await page.keyboard.press(`${modifier}+k`)
  const url = page.getByRole('textbox', { name: formattingCopy[locale].url, exact: true })
  await expect(url).toBeVisible()
  const dialog = page.getByRole('dialog', { name: formattingCopy[locale].dialog, exact: true })
  if (await dialog.count() > 0) {
    await expect.poll(async () => await dialog.evaluate(element =>
      element.getAnimations({ subtree: true }).every(animation =>
        animation.playState === 'finished' || animation.playState === 'idle'))).toBe(true)
  }
  return url
}

/**
 * One shortcut round at one modifier: the dialog is single, cancel and Escape keep the draft
 * and restore the range, Enter saves the destination into the packet, and Undo takes it back.
 */
export async function shortcutRound(
  page: Page,
  api: ApiService,
  body: Locator,
  options: { readonly locale: ComponentLocale, readonly modifier: 'Control' | 'Meta' },
): Promise<void> {
  const copy = formattingCopy[options.locale]
  const dialog = page.getByRole('dialog', { name: copy.dialog, exact: true })
  const writes = (): number => api.calls.filter(call => call.method === 'PUT').length
  let before = writes()
  let url = await openShortcutLink(page, options.locale, options.modifier)
  await expect(dialog).toHaveCount(1)
  await expect(url).toBeFocused()
  await horizontalBounds(page, dialog)
  await url.fill('https://example.com/cancelled')
  await dialog.getByRole('button', { name: copy.cancel, exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expectSelectionRestored(page, body)
  expect(writes()).toBe(before)
  before = writes()
  url = await openShortcutLink(page, options.locale, options.modifier)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expectSelectionRestored(page, body)
  expect(writes()).toBe(before)
  url = await openShortcutLink(page, options.locale, options.modifier)
  await url.fill(linkUrl)
  await url.press('Enter')
  await expect(dialog).toHaveCount(0)
  await expect(body).toBeFocused()
  await expectPacketContent(api, linkedContent(linkUrl))
  await expect(body.locator('a').filter({ hasText: linkSelected })).toHaveAttribute('href', linkUrl)
  await page.getByRole('button', { name: copy.undo, exact: true }).click()
  await expect(body.locator('a')).toHaveCount(0)
  await expectPacketUnlinked(api)
}

/**
 * The rendered links as the character map sees them. A selection that crosses the boundary
 * between two links leaves one anchor per original text run, both carrying the new destination,
 * so adjacent anchors with the same href are one link here; a different href or a shifted
 * character still fails.
 */
async function shapeAnchors(body: Locator): Promise<{ href: string, text: string }[]> {
  const anchors = await body.locator('a').evaluateAll(elements => elements.map(anchor => ({
    href: anchor.getAttribute('href') ?? '',
    text: anchor.textContent,
  })))
  const shaped: { href: string, text: string }[] = []
  for (const anchor of anchors) {
    const previous = shaped.at(-1)
    if (previous !== undefined && previous.href === anchor.href) {
      previous.text += anchor.text
      continue
    }
    shaped.push({ href: anchor.href, text: anchor.text })
  }
  return shaped
}

/**
 * Links one selection of the adjacent-link paragraph and undoes it, so the packet proves the
 * exact characters and styles outside the range are untouched.
 */
export async function linkSelectionRound(
  page: Page,
  api: ApiService,
  body: Locator,
  options: {
    readonly original: ReturnType<typeof charactersOf>
    readonly selection: { readonly from: number, readonly to: number }
    readonly width: number
  },
): Promise<void> {
  const { original, selection } = options
  const copy = formattingCopy.en
  await selectInlineRange(
    page,
    body,
    { start: selection.from, end: selection.to },
    adjacentText.slice(selection.from, selection.to),
  )
  const url = options.width <= 700
    ? await openLinkEntry(page, 'toolbar', options.width, 'en')
    : await openShortcutLink(page, 'en', 'Meta')
  await url.fill(replacementLink)
  await page.getByRole('dialog', { name: copy.dialog, exact: true })
    .getByRole('button', { name: copy.save, exact: true })
    .click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(body).toHaveText(adjacentText)
  const linked = charactersWithLink(original, selection, replacementLink)
  const expectedLinks: { href: string, text: string }[] = []
  let current: { href: string, text: string, end: number } | undefined
  for (const [index, character] of linked.entries()) {
    if (character.href === '') {
      current = undefined
      continue
    }
    if (current !== undefined && current.href === character.href && current.end === index - 1) {
      current.text += character.character
      current.end = index
      continue
    }
    current = { href: character.href, text: character.character, end: index }
    expectedLinks.push(current)
  }
  expect(await shapeAnchors(body)).toEqual(expectedLinks.map(({ href, text }) => ({ href, text })))
  await expectPacketCharacters(api, linked)
  await page.getByRole('button', { name: copy.undo, exact: true }).click()
  await expect(body).toHaveText(adjacentText)
  await expect(body.locator('a')).toHaveCount(2)
  await expect(body.locator('a').nth(0)).toHaveAttribute('href', oldLink)
  await expect(body.locator('a').nth(0)).toHaveText('Alpha')
  await expect(body.locator('a').nth(1)).toHaveAttribute('href', nextLink)
  await expect(body.locator('a').nth(1)).toHaveText('Beta')
  await expectPacketCharacters(api, original)
}

/**
 * Edits the second adjacent link and then removes it. The captured link toolbar acts on the
 * link the case clicked, and each step is asserted against the packet the client sent.
 */
export async function editAndUnlinkRound(page: Page, api: ApiService, body: Locator): Promise<void> {
  const toolbar = page.locator('.bn-link-toolbar')
  await body.locator('a').filter({ hasText: 'Beta' }).click()
  await toolbar.getByRole('button', { name: 'Edit link', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit link', exact: true })
  const title = dialog.getByRole('textbox', { name: 'Edit title', exact: true })
  const url = dialog.getByRole('textbox', { name: 'Edit URL', exact: true })
  await expect(url).toHaveValue(nextLink)
  await expect(title).toHaveValue('Beta')
  await title.fill('')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(title).toBeFocused()
  await expect(dialog.getByRole('alert')).toHaveText('Enter the text to display for this link.')
  // A refused title never touches the draft: nothing has been written yet.
  expect(api.calls.filter(call => call.method === 'PUT')).toEqual([])
  await title.fill('Updated')
  await url.fill('#anchor')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(body).toHaveText('AlphaUpdatedPlain')
  await expect(body.locator('a').filter({ hasText: 'Alpha' })).toHaveAttribute('href', oldLink)
  await expect(body.locator('a').filter({ hasText: 'Updated' })).toHaveAttribute('href', '#anchor')
  await expectPacketCharacters(api, charactersOf(editedLinkContent()))
  await body.locator('a').filter({ hasText: 'Updated' }).click()
  await toolbar.getByRole('button', { name: 'Remove link', exact: true }).click()
  await expect(body.locator('a')).toHaveCount(1)
  await expect(body.locator('a')).toHaveText('Alpha')
  await expect(body.locator('a')).toHaveAttribute('href', oldLink)
  await expectPacketCharacters(api, charactersOf(unlinkedEditedContent()))
  await page.getByRole('button', { name: formattingCopy.en.undo, exact: true }).click()
  await expect(body).toHaveText('AlphaUpdatedPlain')
  await expect(body.locator('a')).toHaveCount(2)
  await expect(body.locator('a').filter({ hasText: 'Updated' })).toHaveAttribute('href', '#anchor')
  await expectPacketCharacters(api, charactersOf(editedLinkContent()))
}

/**
 * Inserts text through the native editor view while the link dialog is open, which is how a
 * background document change reaches the captured target without touching the dialog.
 */
export async function insertBackgroundText(body: Locator, text: string): Promise<void> {
  await body.evaluate((element, inserted) => {
    // eslint-disable-next-line ts/no-unsafe-type-assertion -- Dispatch through the native editor view in this fixture.
    const view = (element as HTMLElement & {
      editor?: { view: { state: EditorState, dispatch: (transaction: Transaction) => void } }
    }).editor?.view
    if (view === undefined) {
      throw new Error('Missing native editor view')
    }
    let from = 0
    view.state.doc.descendants((node, position) => {
      if (node.isText && from === 0) {
        from = position
      }
      return from === 0
    })
    view.dispatch(view.state.tr.insertText(inserted, from))
  }, text)
}
