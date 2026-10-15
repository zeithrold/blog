import type { EditorState, Transaction } from 'prosemirror-state'
import { expect, test } from '@playwright/test'
import { saved, writeDocument } from './helpers'
import { adjacentLinks, characters, nextLink, oldLink, replacementLink, selectOffsets } from './link-edge-helpers'
import { openKeyboardLink, persistedLinkDocument } from './link-keyboard-helpers'
import { fixture } from './preview-history-helpers'

for (const selection of [
  { name: 'partial link', from: 1, to: 3, width: 1440 },
  { name: 'plain text after a link', from: 9, to: 14, width: 1440 },
  { name: 'one adjacent link character', from: 5, to: 6, width: 1440 },
  { name: 'across adjacent links', from: 3, to: 7, width: 1440 },
  { name: 'mobile partial link', from: 1, to: 3, width: 390 },
]) {
  test(`linking ${selection.name} preserves all other characters and styles`, async ({ page }) => {
    await page.setViewportSize({ width: selection.width, height: 900 })
    const document = adjacentLinks()
    await writeDocument(page, document)
    const body = page.getByLabel('Document body', { exact: true })
    await selectOffsets(page, body, selection.from, selection.to)
    const url = await openKeyboardLink(page, 'en', 'Meta')
    await url.fill(replacementLink)
    await page.getByRole('dialog', { name: 'Create link', exact: true })
      .getByRole('button', { name: 'Save', exact: true })
      .click()
    await saved(page)
    await expect(body).toHaveText('AlphaBetaPlain')
    const expected = characters(document).map((character, index) => ({
      ...character,
      href: index >= selection.from && index < selection.to ? replacementLink : character.href,
    }))
    expect(characters((await persistedLinkDocument(page)).document)).toEqual(expected)
    await page.reload()
    expect(characters((await persistedLinkDocument(page)).document)).toEqual(expected)
    await expect(body).toHaveText('AlphaBetaPlain')
  })
}

for (const width of [1440, 320]) {
  test(`existing link edits and unlink target the chosen adjacent link at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 })
    await writeDocument(page, adjacentLinks())
    const body = page.getByLabel('Document body', { exact: true })
    const beta = body.locator('a').filter({ hasText: 'Beta' })
    await beta.click()
    const toolbar = page.locator('.bn-link-toolbar')
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
    expect(characters((await persistedLinkDocument(page)).document)).toEqual(characters(adjacentLinks()))
    await title.fill('Updated')
    await url.fill('#anchor')
    await page.screenshot({ path: info.outputPath(`edit-adjacent-link-${width}.png`) })
    await dialog.getByRole('button', { name: 'Save', exact: true }).click()
    await saved(page)
    await expect(body).toHaveText('AlphaUpdatedPlain')
    await expect(body.locator('a').filter({ hasText: 'Alpha' })).toHaveAttribute('href', oldLink)
    await expect(body.locator('a').filter({ hasText: 'Updated' })).toHaveAttribute('href', '#anchor')
    await body.locator('a').filter({ hasText: 'Updated' }).click()
    await toolbar.getByRole('button', { name: 'Remove link', exact: true }).click()
    await saved(page)
    await expect(body.locator('a')).toHaveCount(1)
    await expect(body.locator('a')).toHaveText('Alpha')
    await expect(body.locator('a')).toHaveAttribute('href', oldLink)
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await saved(page)
    await expect(body.locator('a').filter({ hasText: 'Updated' })).toHaveAttribute('href', '#anchor')
  })
}

test('background document changes keep link input but invalidate the captured target', async ({ page }) => {
  await writeDocument(page, fixture('AlphaBetaPlain'))
  const body = page.getByLabel('Document body', { exact: true })
  await selectOffsets(page, body, 0, 5)
  const url = await openKeyboardLink(page, 'en', 'Meta')
  await url.fill('https://example.com/keep-this-input')
  await body.evaluate((element) => {
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
    view.dispatch(view.state.tr.insertText('Background ', from))
  })
  const dialog = page.getByRole('dialog', { name: 'Create link', exact: true })
  await expect(dialog.getByRole('alert')).toContainText('The document changed.')
  await expect(url).toHaveValue('https://example.com/keep-this-input')
  await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
  await url.press('Enter')
  await expect(dialog).toBeVisible()
  await expect(body.locator('a')).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await saved(page)
  await expect(body).toBeFocused()
  await expect(body).toHaveText('Background AlphaBetaPlain')
})

test('unlink keeps URL-shaped text unlinked after saving and reloading', async ({ page }) => {
  const document = fixture('')
  const block = document.blocks[0]
  if (block === undefined) {
    throw new Error('Missing paragraph')
  }
  block.content = [
    { type: 'link', href: oldLink, content: [
      { type: 'text', text: 'https://example.com ', styles: {} },
    ] },
  ]
  await writeDocument(page, document)
  const body = page.getByLabel('Document body', { exact: true })
  await body.locator('a').click()
  await page.locator('.bn-link-toolbar').getByRole('button', { name: 'Remove link', exact: true }).click()
  await saved(page)
  await expect(body.locator('a')).toHaveCount(0)
  await expect(body).toHaveText('https://example.com ')
  const expected = [
    { type: 'text', text: 'https://example.com ', styles: {} },
  ]
  expect((await persistedLinkDocument(page)).document.blocks[0]?.content).toEqual(expected)
  await page.reload()
  await expect(body.locator('a')).toHaveCount(0)
  expect((await persistedLinkDocument(page)).document.blocks[0]?.content).toEqual(expected)
})
