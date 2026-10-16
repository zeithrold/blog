import type { Page } from '@playwright/test'
import { Buffer } from 'node:buffer'
import { assertAccessible } from '~/tests/support/browser/accessibility'
import { expect, test } from '~/tests/support/browser/test'

async function selectFile(page: Page): Promise<string> {
  await page.goto('/__fixture/login')
  await page.goto('/admin/media')
  await page.getByRole('button', { name: 'Upload media', exact: true }).click()
  const name = `listing-race-${crypto.randomUUID()}.txt`
  await page.getByLabel('Media file', { exact: true }).setInputFiles({
    name,
    mimeType: 'text/plain',
    buffer: Buffer.from('Confirmed upload'),
  })
  return name
}

test('a delayed gallery refresh keeps an upload completed while it was reading', async ({ page }) => {
  const name = await selectFile(page)
  const dialog = page.getByRole('dialog', { name: 'Upload media', exact: true })
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  let release = (): void => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  let reading = false
  await page.route('**/api/admin/assets', async (route) => {
    if (route.request().method() === 'GET') {
      const response = await route.fetch()
      reading = true
      await held
      await route.fulfill({ response })
    }
    else {
      await route.continue()
    }
  })
  try {
    await page.getByRole('button', { name: 'Refresh', exact: true }).click()
    await expect.poll(() => reading).toBe(true)
    await page.getByRole('button', { name: 'Upload media', exact: true }).click()
    await dialog.getByRole('button', { name: 'Upload files', exact: true }).click()
    await expect(dialog.getByRole('listitem').filter({ hasText: name })).toHaveAttribute('data-state', 'complete')
    release()
    await dialog.getByRole('button', { name: 'Close', exact: true }).click()
    const gallery = page.getByRole('list', { name: 'Gallery', exact: true })
    await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled()
    await expect(gallery.getByRole('heading', { name, exact: true })).toBeVisible()
  }
  finally { release() }
})

test('a later authoritative gallery refresh removes a card absent from the server listing', async ({ page }) => {
  const name = await selectFile(page)
  const dialog = page.getByRole('dialog', { name: 'Upload media', exact: true })
  await dialog.getByRole('button', { name: 'Upload files', exact: true }).click()
  await expect(dialog.getByRole('listitem').filter({ hasText: name })).toHaveAttribute('data-state', 'complete')
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  const gallery = page.getByRole('list', { name: 'Gallery', exact: true })
  await expect(gallery.getByRole('heading', { name, exact: true })).toBeVisible()
  await page.route('**/api/admin/assets', async (route) => {
    await route.fulfill({ json: { items: [], nextCursor: null } })
  })
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.getByText('No media yet', { exact: true })).toBeVisible()
  await expect(gallery.getByRole('heading', { name, exact: true })).toHaveCount(0)
})

test('Chinese mobile gallery explains retention and restores files after navigation', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto('/__fixture/login')
  await page.goto('/admin/media')
  await page.getByRole('button', { name: 'Appearance', exact: true }).click()
  await page.getByRole('menuitemradio', { name: 'Dark', exact: true }).click()
  await page.getByRole('combobox', { name: 'Language', exact: true }).click()
  await page.getByRole('option', { name: '简体中文', exact: true }).click()
  await page.reload()
  await expect(page.getByRole('heading', { name: '图库', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '上传媒体', exact: true }).click()
  const name = `手机上传-${crypto.randomUUID()}.txt`
  await page.getByLabel('媒体文件', { exact: true }).setInputFiles({
    name,
    mimeType: 'text/plain',
    buffer: Buffer.from('手机选中的文件'),
  })
  await page.getByRole('button', { name: '关闭', exact: true }).click()
  await expect(page.locator('.media-session-note')).toContainText('在此标签页内切换页面会保留上传队列')
  await assertAccessible(page, info, { label: 'gallery-retention-zh-dark-320' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('gallery-retention-zh-dark-320.png') })
  await page.getByRole('button', { name: '媒体库', exact: true }).click()
  await page.getByRole('menuitem', { name: '标签', exact: true }).click()
  await expect(page.getByRole('heading', { name: '标签', exact: true })).toBeVisible()
  await page.goBack()
  const trigger = page.getByRole('button', { name: '上传媒体', exact: true })
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: '上传媒体', exact: true })
  const row = dialog.getByRole('listitem').filter({ hasText: name })
  await expect(row).toHaveAttribute('data-state', 'queued')
  await assertAccessible(page, info, { label: 'gallery-restored-queue-zh-dark-320' })
  await page.screenshot({ path: info.outputPath('gallery-restored-queue-zh-dark-320.png') })
  await dialog.getByRole('button', { name: '关闭', exact: true }).click()
  await expect(trigger).toBeFocused()
  await trigger.click()
  await dialog.getByRole('button', { name: '上传文件', exact: true }).click()
  await expect(row).toHaveAttribute('data-state', 'complete')
})
