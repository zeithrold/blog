import {
  formattingCopy,
  linkPrefix,
  linkSelected,
  linkSuffix,
  openFormattingWorkspace,
  openLinkEntry,
  selectRange,
} from '../support/editor-formatting-fixtures'
import { expect, test } from '../support/test'

const invalidDestinations = [
  '',
  'https://exa mple.com',
  'ftp://example.com',
  '//elsewhere.example/path',
  'https://user:password@example.com',
  `example.com/${'x'.repeat(2036)}`,
]

const text = `${linkPrefix}${linkSelected}${linkSuffix}`
const selected = { start: linkPrefix.length, end: linkPrefix.length + linkSelected.length }

test('the desktop shortcut opens one link editor focused on its destination', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 740 })
  const { api, body } = await openFormattingWorkspace(page, text)
  try {
    await selectRange(page, body, selected, linkSelected)
    const url = await openLinkEntry(page, 'keyboard', 1440)
    await expect(url).toBeFocused()
    await page.getByRole('dialog', { name: 'Create link', exact: true })
      .getByRole('button', { name: 'Cancel', exact: true })
      .click()
    await expect(body).toBeFocused()
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

test('the compact formatting drawer reaches the same link entry at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 740 })
  const { api, body } = await openFormattingWorkspace(page, text)
  try {
    await selectRange(page, body, selected, linkSelected)
    const url = await openLinkEntry(page, 'toolbar', 390)
    await expect(url).toBeFocused()
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

test('keyboard invalid destinations are refused at 1440px in en', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 740 })
  const copy = formattingCopy.en
  const { api, body } = await openFormattingWorkspace(page, text, 'en')
  try {
    await selectRange(page, body, selected, linkSelected)
    const url = await openLinkEntry(page, 'keyboard', 1440, 'en')
    const dialog = page.getByRole('dialog', { name: copy.dialog, exact: true })
    const save = dialog.getByRole('button', { name: copy.save, exact: true })
    for (const value of invalidDestinations) {
      await url.fill(value)
      await save.click()
      await expect(url).toBeFocused()
    }
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})
