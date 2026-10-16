import type { Page } from '@playwright/test'
import { Buffer } from 'node:buffer'
import { openDocumentSchema } from '@/content/contracts'
import { assertAccessible } from '~/tests/support/browser/accessibility'
import { saved, writeDocument } from '~/tests/support/browser/document'
import { fixture } from '~/tests/support/browser/document-fixture'
import { withinViewport } from '~/tests/support/browser/layout'
import { setChinese } from '~/tests/support/browser/locale'
import { expect, test } from '~/tests/support/browser/test'

async function navigateToTags(page: Page, chinese = false): Promise<void> {
  const mobile = page.locator('.workspace-navigation-mobile')
  if (await mobile.isVisible()) {
    await mobile.click()
    await page.getByRole('menuitem', { name: chinese ? '标签' : 'Tags', exact: true }).click()
  }
  else {
    await page.getByRole('link', { name: chinese ? '标签' : 'Tags', exact: true }).click()
  }
}

test('cancelling a navigation while saving prevents a late redirect and keeps subsequent edits', async ({ page }) => {
  const original = await writeDocument(page, fixture('Stay during saving'))
  let release = (): void => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/revisions', async (route) => {
    await held
    await route.continue()
  }, { times: 1 })
  const title = page.getByRole('textbox', { name: 'Title', exact: true })
  await title.fill('First edit')
  await navigateToTags(page)
  const dialog = page.getByRole('dialog', { name: 'Saving before leaving', exact: true })
  await dialog.getByRole('button', { name: 'Stay here', exact: true }).click()
  await title.fill('Second edit after cancelling')
  release()
  await saved(page)
  await expect(dialog).toHaveCount(0)
  await expect(page).toHaveURL(new RegExp(`/admin/documents/${original.documentId}$`))
  const current = openDocumentSchema.parse(await (await page.request.get(
    `/api/admin/documents/${original.documentId}`,
  )).json())
  expect(current.document.meta.title).toBe('Second edit after cancelling')
})

for (const action of ['retry', 'leave'] as const) {
  test(`failed departure preserves its reason and supports explicit ${action}`, async ({ page }, info) => {
    const chinese = action === 'retry'
    await page.setViewportSize({ width: chinese ? 320 : 1440, height: 900 })
    const initial = fixture('Failed departure')
    const original = await writeDocument(page, initial)
    if (chinese) {
      await setChinese(page)
      await page.getByRole('button', { name: '外观', exact: true }).click()
      await page.getByRole('menuitemradio', { name: '深色', exact: true }).click()
    }
    await page.route('**/revisions', async route => await route.fulfill({
      status: 503,
      json: { code: 'CONNECTION_FAILED' },
    }))
    await page.getByRole('textbox', { name: chinese ? '标题' : 'Title', exact: true }).fill('Unsaved departure edit')
    await navigateToTags(page, chinese)
    const dialog = page.getByRole('dialog', { name: chinese ? '离开前保存' : 'Save before leaving', exact: true })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('alert')).not.toContainText('CONNECTION_FAILED')
    await expect(dialog.getByRole('alert')).toContainText(chinese ? '本地草稿副本' : 'A local draft copy has been saved')
    await withinViewport(page, dialog)
    await assertAccessible(page, info, { label: `editor-departure-error-${action}` })
    await page.screenshot({ path: info.outputPath(`editor-departure-${action}.png`) })
    await expect(page).toHaveURL(new RegExp(`/admin/documents/${original.documentId}$`))
    if (action === 'retry') {
      await page.unroute('**/revisions')
    }
    await dialog.getByRole('button', {
      name: chinese ? '重试保存' : 'Leave without saving',
      exact: true,
    }).click()
    await expect(page.getByRole('heading', { name: chinese ? '标签' : 'Tags', exact: true })).toBeVisible()
    const current = openDocumentSchema.parse(await (await page.request.get(
      `/api/admin/documents/${original.documentId}`,
    )).json())
    expect(current.document.meta.title).toBe(action === 'retry' ? 'Unsaved departure edit' : initial.meta.title)
  })
}

for (const failed of [false, true]) {
  test(`${failed ? 'failed' : 'queued'} files protect reload and block sidebar departure`, async ({ page }) => {
    await writeDocument(page, fixture('Pending files'))
    await saved(page)
    await page.getByRole('button', { name: 'Add media', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Add media', exact: true })
    await dialog.getByRole('tab', { name: 'Upload files', exact: true }).click()
    await dialog.getByLabel('Media file', { exact: true }).setInputFiles({
      name: 'pending.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Keep this file'),
    })
    if (failed) {
      await page.route('**/api/admin/assets', async route => await route.fulfill({
        status: 503,
        json: { code: 'CONNECTION_FAILED' },
      }))
      await dialog.getByRole('button', { name: 'Upload files', exact: true }).click()
      await expect(dialog.locator('.media-upload-item')).toHaveAttribute('data-state', 'failed')
    }
    await dialog.getByRole('button', { name: 'Close', exact: true }).click()
    await expect.poll(async () => await page.evaluate(() => {
      const event = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(event)
      return event.defaultPrevented
    })).toBe(true)
    await navigateToTags(page)
    const blocked = page.getByRole('dialog', { name: 'Save before leaving', exact: true })
    await expect(blocked.getByRole('alert')).toContainText('Finish or remove the queued uploads before leaving.')
    await blocked.getByRole('button', { name: 'Stay here', exact: true }).click()
    await page.getByRole('button', { name: 'Add media', exact: true }).click()
    await dialog.getByRole('tab', { name: 'Upload files', exact: true }).click()
    await expect(dialog.locator('.media-upload-item')).toContainText('pending.txt')
  })
}
