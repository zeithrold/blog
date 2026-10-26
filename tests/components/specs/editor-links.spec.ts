import type { ComponentLocale } from '../src/contract'
import {
  expectPacketContent,
  formattingCopy,
  linkPrefix,
  linkSelected,
  linkSuffix,
  openFormattingWorkspace,
  openLinkEntry,
  revisionWrites,
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

const normalized = [
  ['/posts/entry#part', '/posts/entry#part'],
  ['HTTPS://example.com/Case', 'https://example.com/Case'],
  ['httpbin.org/get', 'https://httpbin.org/get'],
  ['#section', '#section'],
] as const

const text = `${linkPrefix}${linkSelected}${linkSuffix}`
const selected = { start: linkPrefix.length, end: linkPrefix.length + linkSelected.length }

function linkedContent(href: string): unknown[] {
  return [
    { type: 'text', text: linkPrefix, styles: {} },
    { type: 'link', href, content: [
      { type: 'text', text: linkSelected, styles: {} },
    ] },
    { type: 'text', text: linkSuffix, styles: {} },
  ]
}

test('the desktop shortcut opens one link editor focused on its destination', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 740 })
  const { api, body } = await openFormattingWorkspace(page, text)
  try {
    await selectRange(page, body, selected, linkSelected)
    const url = await openLinkEntry(page, 'keyboard', 1440)
    await expect(url).toBeFocused()
    // A repeated shortcut reuses the one editor instead of stacking dialogs.
    await openLinkEntry(page, 'keyboard', 1440)
    await expect(page.getByRole('textbox', { name: 'Edit URL', exact: true })).toHaveCount(1)
    await page.getByRole('dialog', { name: 'Create link', exact: true })
      .getByRole('button', { name: 'Cancel', exact: true })
      .click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(body).toBeFocused()
    expect(revisionWrites(api)).toEqual([])
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
    await url.fill('/posts/drawer')
    await url.press('Enter')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(body).toBeFocused()
    await expectPacketContent(api, linkedContent('/posts/drawer'))
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

for (const { entry, width, locale } of [
  { entry: 'keyboard', width: 1440, locale: 'en' },
  { entry: 'toolbar', width: 390, locale: 'en' },
  { entry: 'keyboard', width: 320, locale: 'zh' },
  { entry: 'toolbar', width: 320, locale: 'zh' },
] as const satisfies readonly { entry: 'keyboard' | 'toolbar', width: number, locale: ComponentLocale }[]) {
  test(`${entry} invalid destinations are refused at ${width}px in ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 740 })
    const copy = formattingCopy[locale]
    const { api, body } = await openFormattingWorkspace(page, text, locale)
    try {
      await selectRange(page, body, selected, linkSelected)
      const url = await openLinkEntry(page, entry, width, locale)
      const dialog = page.getByRole('dialog', { name: copy.dialog, exact: true })
      const save = dialog.getByRole('button', { name: copy.save, exact: true })
      for (const value of invalidDestinations) {
        await url.fill(value)
        await save.click()
        await expect(url).toBeFocused()
        await expect(url).toHaveAttribute('aria-invalid', 'true')
        await expect(dialog.getByRole('alert')).toContainText(copy.invalid)
        await expect(body.locator('a')).toHaveCount(0)
      }
      // Nothing reached the coordinator: an invalid destination never touches the draft.
      expect(revisionWrites(api)).toEqual([])
      await dialog.getByRole('button', { name: copy.cancel, exact: true }).click()
      await expect(dialog).toHaveCount(0)
      await expect(body).toBeFocused()
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })

  test(`${entry} destinations normalize and undo restores the range at ${width}px in ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 740 })
    const copy = formattingCopy[locale]
    const { api, body } = await openFormattingWorkspace(page, text, locale)
    try {
      for (const [value, href] of normalized) {
        await selectRange(page, body, selected, linkSelected)
        const url = await openLinkEntry(page, entry, width, locale)
        await url.fill(value)
        await url.press('Enter')
        await expect(page.getByRole('dialog')).toHaveCount(0)
        await expect(body).toBeFocused()
        await expect(body.locator('a')).toHaveAttribute('href', href)
        await expectPacketContent(api, linkedContent(href))
        await page.getByRole('button', { name: copy.undo, exact: true }).click()
        await expect(body.locator('a')).toHaveCount(0)
      }
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}
