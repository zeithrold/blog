import { Buffer } from 'node:buffer'
import { assertAccessible } from '~/tests/support/browser/accessibility'
import { expect, test } from '~/tests/support/browser/test'
import { galleryReady } from './media-gallery-helpers'

// The listing/read-state cases moved to tests/components/specs/media-listing.spec.ts.
test('Chinese mobile gallery explains retention and restores files after navigation', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto('/__fixture/login')
  await page.goto('/admin/media')
  await galleryReady(page)
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
