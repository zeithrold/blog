import { saved } from '~/tests/support/browser/document'
import { settingsTab } from '~/tests/support/browser/settings'
import { chromeDocument, openChrome } from '../support/editor-chrome-fixtures'
import { chromeGeometry, headerHeight } from '../support/editor-chrome-ui'
import { editorWorkspaceDocument } from '../support/editor-workspace-fixtures'
import { expect, test } from '../support/test'

/**
 * The editor's own chrome: the sticky header and toolbar against the real shell
 * appbar, the compact inspector beside the mounted native editor, and the
 * schedule form that belongs to that editor.
 */

// The settings drawer stays over a live BlockNote editor, and native focus
// returns to its trigger after closing both before and after a layout change.
test('compact settings drawer returns focus after close and reopen', async ({
  page,
}) => {
  const document = editorWorkspaceDocument('Schedule survives the inspector')
  const api = await openChrome(page, {
    document,
    width: 320,
    height: 740,
  })
  try {
    await settingsTab(page, 'Publication')
    const trigger = page.getByRole('button', { name: 'Document settings', exact: true })
    await page.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(trigger).toBeFocused()
    await page.setViewportSize({ width: 1440, height: 1000 })
    await expect(page.locator('.document-settings')).toBeVisible()
    await page.setViewportSize({ width: 320, height: 740 })
    await trigger.click()
    await expect(page.getByRole('dialog', { name: 'Document settings', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(trigger).toBeFocused()
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
    await body.fill('A long draft paragraph for scrolling. '.repeat(120))
    await saved(page)
    await page.evaluate(() => window.scrollTo(0, 650))
    await expect.poll(async () => (await chromeGeometry(page)).toolbarGap).toBeGreaterThanOrEqual(-1)
    await expect.poll(async () => Math.abs((await chromeGeometry(page)).headerGap)).toBeLessThanOrEqual(1)
    expect((await chromeGeometry(page)).overflow).toBe(false)
    const narrowHeight = await headerHeight(page)
    await page.setViewportSize({ width: 1440, height: 1000 })
    await expect.poll(async () => await headerHeight(page)).toBeLessThan(narrowHeight)
    await page.setViewportSize({ width: 320, height: 740 })
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
