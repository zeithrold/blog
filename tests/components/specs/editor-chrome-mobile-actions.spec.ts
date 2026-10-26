import type { Locator, Page } from '@playwright/test'
import type { ChromeCopy } from '../support/editor-chrome-ui'
import { CHROME_ROUTES, chromeDocument, openChrome } from '../support/editor-chrome-fixtures'
import { box, chooseLanguage, chromeCopy, editorChrome, horizontalOverflow } from '../support/editor-chrome-ui'
import { editorWorkspaceWrites } from '../support/editor-workspace-fixtures'
import { apiKey, failure } from '../support/http-fixtures'
import { expect, test } from '../support/test'

/**
 * The compact editor header and its document-actions drawer: two header rows of
 * real controls, focus returned to the trigger after every overlay, and the
 * localized copy the author actually reads.
 */

/** The two header rows: one centre line, real touch heights, status below them. */
async function expectHeaderRows(page: Page, copy: ChromeCopy): Promise<void> {
  const header = editorChrome(page)
  const back = header.getByRole('link', { name: copy.back, exact: true })
  const publish = header.getByRole('button', { name: copy.publish, exact: true })
  const more = header.getByRole('button', { name: copy.more, exact: true })
  await expect.poll(async () => await back.innerText()).toBe(copy.compactBack)
  await expect(publish).toBeVisible()
  await expect(header.getByRole('button', { name: /^(Save|保存)$/ })).toHaveCount(0)
  const positions = await Promise.all([
    box(back),
    box(publish),
    box(more),
    box(header),
  ])
  const [backBox, publishBox, moreBox, headerBox] = positions
  const center = (bounds: { top: number, height: number }): number => bounds.top + bounds.height / 2
  expect(Math.abs(center(backBox) - center(publishBox))).toBeLessThanOrEqual(2)
  expect(Math.abs(center(moreBox) - center(publishBox))).toBeLessThanOrEqual(2)
  expect(publishBox.height).toBeGreaterThanOrEqual(44)
  expect(moreBox.height).toBeGreaterThanOrEqual(44)
  expect(headerBox.height).toBeLessThanOrEqual(110)
  const statusBox = await box(header.locator('.workspace-status'))
  expect(statusBox.top).toBeGreaterThanOrEqual(publishBox.bottom)
  expect(await horizontalOverflow(page)).toBe(false)
}

/** Opens the drawer and reads its shape, its copy and its disabled flush. */
async function openActionDrawer(page: Page, copy: ChromeCopy, chinese: boolean): Promise<Locator> {
  await page.getByRole('button', { name: copy.more, exact: true }).click()
  const drawer = page.getByRole('dialog', { name: copy.more, exact: true })
  await expect(drawer).toBeVisible()
  await expect(drawer.locator('[data-slot="drawer-handle"]')).toBeVisible()
  await expect(drawer).toContainText(chinese ? /自动保存/ : /automatically/)
  await expect(drawer.getByRole('button', { name: copy.sync, exact: true })).toBeDisabled()
  await expect(page.getByRole('menu')).toHaveCount(0)
  return drawer
}

/** Close, Escape and a cancelled confirmation each hand focus back to the trigger. */
async function expectDrawerFocus(page: Page, drawer: Locator, copy: ChromeCopy): Promise<void> {
  const more = page.getByRole('button', { name: copy.more, exact: true })
  await drawer.getByRole('button', { name: copy.close, exact: true }).click()
  await expect(drawer).toHaveCount(0)
  await expect(more).toBeFocused()
  await more.click()
  await page.keyboard.press('Escape')
  await expect(drawer).toHaveCount(0)
  await expect(more).toBeFocused()
  await more.click()
  await drawer.getByRole('button', { name: copy.remove, exact: true }).click()
  await expect(drawer).toHaveCount(0)
  const confirmation = page.getByRole('dialog')
  await expect(confirmation).toBeVisible()
  await confirmation.getByRole('button', { name: copy.cancel, exact: true }).click()
  await expect(confirmation).toHaveCount(0)
  await expect(more).toBeFocused()
}

for (const width of [320, 390]) {
  for (const locale of ['en', 'zh'] as const) {
    test(`mobile actions fit two header rows at ${width}px in ${locale} and return focus after dialogs`, async ({
      page,
    }, info) => {
      const copy = chromeCopy[locale]
      const document = chromeDocument('Mobile document actions', 'A compact mobile writing workspace')
      const api = await openChrome(page, { document, width, height: 740 })
      try {
        if (locale === 'zh') {
          await chooseLanguage(page, locale)
        }
        await expectHeaderRows(page, copy)
        await page.screenshot({ path: info.outputPath(`mobile-editor-header-${locale}-${width}.png`) })
        const drawer = await openActionDrawer(page, copy, locale === 'zh')
        await page.screenshot({ path: info.outputPath(`mobile-editor-actions-${locale}-${width}.png`) })
        await expectDrawerFocus(page, drawer, copy)
        await expect(page.getByLabel('Document body', { exact: true }))
          .toContainText('A compact mobile writing workspace')
        await api.expectServed()
      }
      finally {
        await api.dispose()
      }
    })
  }
}

// Preview is the one drawer action that opens a second surface instead of a
// confirmation, and resizing must never reopen a panel the author dismissed.
test('mobile preview closes the action drawer and resizing never reopens a dismissed panel', async ({
  page,
}) => {
  const document = chromeDocument('Mobile document actions', 'A current draft opened from mobile actions')
  const api = await openChrome(page, { document, width: 390, height: 844 })
  try {
    const more = page.getByRole('button', { name: 'More document actions', exact: true })
    const drawer = page.getByRole('dialog', { name: 'More document actions', exact: true })
    await more.click()
    await drawer.getByRole('button', { name: 'Preview', exact: true }).click()
    const preview = page.getByRole('dialog', { name: 'Draft preview', exact: true })
    await expect(drawer).toHaveCount(0)
    await expect(preview.getByRole('heading', { name: 'Mobile document actions', exact: true })).toBeVisible()
    await expect(preview).toContainText('A current draft opened from mobile actions')
    await preview.getByRole('button', { name: 'Close preview', exact: true }).click()
    await expect(preview).toHaveCount(0)
    await expect(more).toBeFocused()
    await more.click()
    await expect(drawer).toBeVisible()
    await page.setViewportSize({ width: 1440, height: 1000 })
    await expect(drawer).toHaveCount(0)
    await expect(page.getByRole('menu')).toHaveCount(0)
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(drawer).toHaveCount(0)
    await more.click()
    await expect(drawer).toBeVisible()
    await drawer.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(more).toBeFocused()
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

// A refused revision write is the client's conflict state: the draft stays in the
// editor, the drawer offers no flush, and nothing else reaches the boundary.
test('mobile sync remains disabled when a draft requires conflict resolution', async ({ page }) => {
  const document = chromeDocument('Conflicting mobile draft')
  const api = await openChrome(page, {
    document,
    width: 390,
    height: 844,
    serve: {
      [CHROME_ROUTES.revision]: () => failure(409, 'EDIT_CONFLICT'),
    },
  })
  try {
    const body = page.getByLabel('Document body', { exact: true })
    await body.fill('Keep this local conflicting draft')
    await expect(page.getByText('Conflict — draft preserved', { exact: true }))
      .toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'More document actions', exact: true }).click()
    const drawer = page.getByRole('dialog', { name: 'More document actions', exact: true })
    await expect(drawer.getByRole('button', { name: 'Sync draft now', exact: true })).toBeDisabled()
    await drawer.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(body).toContainText('Keep this local conflicting draft')
    // Only the refused draft write was attempted, so no stored revision exists to
    // compare: the server's head cannot have moved past the opened one.
    const writes = editorWorkspaceWrites(api.calls).map(call => apiKey(call.method, call.path))
    expect(writes.length).toBeGreaterThan(0)
    expect(writes.every(route => route === CHROME_ROUTES.revision)).toBe(true)
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})
