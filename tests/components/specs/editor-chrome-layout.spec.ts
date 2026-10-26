import { chooseTimezone, publicationTime, verifiedTime } from '~/tests/browser/publication/schedule-helpers'
import { saved } from '~/tests/support/browser/document'
import { settingsTab } from '~/tests/support/browser/settings'
import { chromeDocument, openChrome, verifiedScheduleTimes } from '../support/editor-chrome-fixtures'
import { chromeGeometry, headerHeight } from '../support/editor-chrome-ui'
import { editorWorkspaceDocument } from '../support/editor-workspace-fixtures'
import { watchErrors } from '../support/http-fixtures'
import { expect, test } from '../support/test'

/**
 * The editor's own chrome: the sticky header and toolbar against the real shell
 * appbar, the compact inspector beside the mounted native editor, and the
 * schedule form that belongs to that editor.
 */

// The schedule form is part of the mounted editor, so closing the compact
// inspector and changing the layout must keep the typed plan and the verified
// offset the author chose.
test('schedule input and verified times survive closing the compact inspector and resizing', async ({
  page,
}) => {
  const document = editorWorkspaceDocument('Schedule survives the inspector')
  const api = await openChrome(page, {
    document,
    width: 320,
    height: 740,
    serve: {
      // 10:30 in Asia/Tokyo is 01:30 UTC at a fixed +540 minutes.
      'GET /api/admin/schedule-time': () => verifiedScheduleTimes(Date.UTC(2099, 4, 1, 1, 30), 540),
    },
  })
  try {
    await settingsTab(page, 'Publication')
    await page.getByText('Scheduled publication', { exact: true }).click()
    await publicationTime(page, '2099-05-01T10:30')
    await chooseTimezone(page, 'Asia/Tokyo')
    await page.getByRole('button', { name: 'Check timezone and DST', exact: true }).click()
    const time = page.getByRole('combobox', { name: 'Verified UTC time', exact: true })
    const verified = await verifiedTime(page)
    await page.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Document settings', exact: true })).toBeFocused()
    await page.getByRole('button', { name: 'Document settings', exact: true }).click()
    await expect(page.getByRole('tab', { name: 'Publication', exact: true }))
      .toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('combobox', { name: 'Publication timezone', exact: true }))
      .toContainText('Asia/Tokyo')
    await expect(page.getByRole('button', { name: 'Publication date', exact: true }))
      .toContainText('May 1, 2099')
    await expect(page.getByLabel('Publication time', { exact: true })).toHaveValue('10:30')
    await expect(time).toHaveText(verified)
    await page.getByRole('button', { name: 'Close', exact: true }).click()
    await page.setViewportSize({ width: 1440, height: 1000 })
    await expect(page.getByRole('tab', { name: 'Publication', exact: true }))
      .toHaveAttribute('aria-selected', 'true')
    await expect(time).toHaveText(verified)
    await expect(page.getByRole('combobox', { name: 'Publication timezone', exact: true }))
      .toContainText('Asia/Tokyo')
    await page.setViewportSize({ width: 320, height: 740 })
    await page.getByRole('button', { name: 'Document settings', exact: true }).click()
    await expect(time).toHaveText(verified)
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

// The sticky toolbar offset follows the height the header actually measures, and
// a wrapped status row at 320px must not push the toolbar under the header or
// scroll the page sideways.
test('wrapped status keeps the sticky toolbar below the measured header at 320px', async ({
  page,
}, info) => {
  const errors = watchErrors(page)
  const document = editorWorkspaceDocument('A narrow writing workspace')
  const api = await openChrome(page, { document, width: 320, height: 740 })
  try {
    await settingsTab(page, 'Content')
    await page.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Document settings', exact: true })).toHaveCount(0)
    const body = page.getByLabel('Document body', { exact: true })
    await body.fill('Published content')
    await saved(page)
    await page.getByRole('button', { name: 'Publish', exact: true }).click()
    await expect(page.getByText('Published', { exact: true })).toBeVisible()
    await body.fill('A long draft paragraph for scrolling. '.repeat(120))
    await saved(page)
    await expect(page.getByText('Published · unpublished changes', { exact: true })).toBeVisible()
    await page.evaluate(() => window.scrollTo(0, 650))
    await expect.poll(async () => (await chromeGeometry(page)).toolbarGap).toBeGreaterThanOrEqual(-1)
    await expect.poll(async () => Math.abs((await chromeGeometry(page)).headerGap)).toBeLessThanOrEqual(1)
    expect((await chromeGeometry(page)).overflow).toBe(false)
    const narrowHeight = await headerHeight(page)
    await page.setViewportSize({ width: 1440, height: 1000 })
    await expect.poll(async () => await headerHeight(page)).toBeLessThan(narrowHeight)
    await page.setViewportSize({ width: 320, height: 740 })
    errors.expectNone()
    await page.screenshot({ path: info.outputPath('editor-sticky-320.png') })
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

// The compact inspector is an overlay over the mounted editor: it opens from the
// bottom, its footer stays reachable while the region scrolls, and closing or
// widening the layout keeps the same native editor node.
test('the compact inspector opens from the bottom and keeps its footer reachable while scrolling', async ({
  page,
}) => {
  const document = chromeDocument('Drawer writing workspace')
  const api = await openChrome(page, { document, width: 320, height: 740 })
  try {
    const body = page.getByLabel('Document body', { exact: true })
    await expect(body).toBeVisible()
    const identity = await body.elementHandle()
    await body.fill('Keep this native editor mounted while the inspector changes.')
    await saved(page)
    await settingsTab(page, 'Content')
    const drawer = page.getByRole('dialog', { name: 'Document settings', exact: true })
    await expect(drawer).toHaveClass(/inspector-drawer/)
    await expect(drawer.locator('[data-slot="drawer-handle"]')).toBeVisible()
    await expect.poll(async () => await drawer.evaluate((element) => {
      const bounds = element.getBoundingClientRect()
      return Math.abs(bounds.bottom - window.innerHeight)
    })).toBeLessThanOrEqual(2)
    expect(await drawer.evaluate(element => element.getBoundingClientRect().height <= window.innerHeight * 0.9 + 2))
      .toBe(true)
    await drawer.getByRole('button', { name: /^References \(/ }).click()
    await drawer.getByRole('button', { name: 'Add reference', exact: true }).click()
    const reference = page.getByRole('dialog', { name: 'Add reference', exact: true })
    await reference.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(reference).toHaveCount(0)
    const scroll = drawer.getByRole('region', { name: 'Document settings', exact: true })
    expect(await scroll.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true)
    await scroll.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
    const close = drawer.getByRole('button', { name: 'Close', exact: true })
    await expect(close).toBeInViewport()
    await close.click()
    await expect(page.getByRole('button', { name: 'Document settings', exact: true })).toBeFocused()
    await expect(body).toContainText('Keep this native editor mounted')
    expect(await identity.evaluate(element => element.isConnected)).toBe(true)
    await page.getByRole('button', { name: 'Document settings', exact: true }).click()
    await expect(drawer.getByRole('tab', { name: 'Content', exact: true }))
      .toHaveAttribute('aria-selected', 'true')
    await page.setViewportSize({ width: 1440, height: 1000 })
    await expect(page.locator('.document-settings')).toBeVisible()
    await expect(drawer).toHaveCount(0)
    expect(await identity.evaluate(element => element.isConnected)).toBe(true)
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})
