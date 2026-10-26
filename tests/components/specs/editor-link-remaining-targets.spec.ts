/* eslint-disable style/max-len -- Verbatim case titles stay on one line. */
import { expectPacketContent, revisionWrites } from '../support/editor-formatting-fixtures'
import {
  adjacentLinkContent,
  adjacentLinks,
  charactersOf,
  openLinkWorkspace,
  urlShapedDocument,
} from '../support/editor-link-remaining-fixtures'
import {
  editAndUnlinkRound,
  insertBackgroundText,
  linkSelectionRound,
  openShortcutLink,
  selectInlineRange,
} from '../support/editor-link-remaining-ui'
import { expect, test } from '../support/test'

const desktopSelections = [
  { from: 1, to: 3 },
  { from: 9, to: 14 },
  { from: 5, to: 6 },
  { from: 3, to: 7 },
] as const

// One case per width: the four desktop selection shapes the retired cases ran stay separate
// assertions inside it, and the compact partial link keeps its own case.
test('linking partial, following and crossing selections preserves all other characters and styles at 1440px', async ({ page }) => {
  const { api, body } = await openLinkWorkspace(page, { document: adjacentLinks(), width: 1440 })
  try {
    const original = charactersOf(adjacentLinkContent())
    for (const selection of desktopSelections) {
      await linkSelectionRound(page, api, body, { original, selection })
    }
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

test('linking a mobile partial link preserves all other characters and styles at 320px', async ({ page }) => {
  const { api, body } = await openLinkWorkspace(page, { document: adjacentLinks(), width: 320 })
  try {
    await linkSelectionRound(page, api, body, {
      original: charactersOf(adjacentLinkContent()),
      selection: { from: 1, to: 3 },
    })
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

for (const width of [1440, 320]) {
  test(`existing link edits and unlink target the chosen adjacent link at ${width}px`, async ({ page }) => {
    const { api, body } = await openLinkWorkspace(page, { document: adjacentLinks(), width })
    try {
      await editAndUnlinkRound(page, api, body)
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}

test('background document changes keep link input but invalidate the captured target', async ({ page }) => {
  const { api, body } = await openLinkWorkspace(page, { text: 'AlphaBetaPlain', width: 1440 })
  try {
    await selectInlineRange(page, body, { start: 0, end: 5 }, 'Alpha')
    const url = await openShortcutLink(page, 'en', 'Meta')
    await url.fill('https://example.com/keep-this-input')
    await insertBackgroundText(body, 'Background ')
    const dialog = page.getByRole('dialog', { name: 'Create link', exact: true })
    await expect(dialog.getByRole('alert')).toContainText('The document changed.')
    await expect(url).toHaveValue('https://example.com/keep-this-input')
    await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
    await url.press('Enter')
    await expect(dialog).toBeVisible()
    await expect(body.locator('a')).toHaveCount(0)
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(body).toBeFocused()
    await expect(body).toHaveText('Background AlphaBetaPlain')
    await expectPacketContent(api, [
      { type: 'text', text: 'Background AlphaBetaPlain', styles: {} },
    ])
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

// A stored unlink leaves URL-shaped text behind, so loading that text must not relink it and
// the next packet must still carry it as plain text.
test('unlinked URL-shaped text loads and saves as plain text', async ({ page }) => {
  const { api, body } = await openLinkWorkspace(page, { document: urlShapedDocument() })
  try {
    await expect(body).toHaveText('https://example.com ')
    await expect(body.locator('a')).toHaveCount(0)
    expect(revisionWrites(api)).toEqual([])
    await insertBackgroundText(body, 'Plain ')
    await expect(body).toHaveText('Plain https://example.com ')
    await expect(body.locator('a')).toHaveCount(0)
    await expectPacketContent(api, [
      { type: 'text', text: 'Plain https://example.com ', styles: {} },
    ])
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})
