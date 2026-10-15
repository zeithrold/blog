import { Buffer } from 'node:buffer'
import { expect, test } from '@playwright/test'
import { assetListSchema } from '../../src/content/service-contracts'
import { assertAccessible } from './accessibility'
import { interruptTransfer } from './media-transfer-helpers'

for (const outcome of [
  'committed',
  'disconnected',
  'csrf-renewal',
] as const) {
  const committed = outcome === 'committed'
  test(`media retry reuses its upload allocation after a ${outcome} transfer`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: committed ? 320 : 1440, height: 900 })
    await page.goto('/__fixture/login')
    await page.goto('/admin/media')
    if (committed) {
      await page.getByRole('button', { name: 'Appearance', exact: true }).click()
      await page.getByRole('menuitemradio', { name: 'Dark', exact: true }).click()
      await page.getByRole('combobox', { name: 'Language', exact: true }).click()
      await page.getByRole('option', { name: '简体中文', exact: true }).click()
      await page.reload()
      await expect(page.getByRole('heading', { name: '图库', exact: true })).toBeVisible()
    }
    const upload = committed ? '上传媒体' : 'Upload media'
    await page.getByRole('button', { name: upload, exact: true }).click()
    const dialog = page.getByRole('dialog', { name: upload, exact: true })
    const filename = `recover-${crypto.randomUUID()}.txt`
    const payload = Buffer.from('Uploaded once')
    const { allocations, transfers } = await interruptTransfer(page, outcome, payload)
    await page.getByLabel(committed ? '媒体文件' : 'Media file', { exact: true }).setInputFiles({
      name: filename,
      mimeType: 'text/plain',
      buffer: payload,
    })
    const row = dialog.getByRole('listitem').filter({ hasText: filename })
    await dialog.getByRole('button', { name: committed ? '上传文件' : 'Upload files', exact: true }).click()
    await expect(row).toHaveAttribute('data-state', 'failed')
    if (committed) {
      await expect(row.getByRole('alert')).toContainText('暂时无法确认上传结果')
      await assertAccessible(page, info, { label: 'unknown-media-upload-zh-dark-320' })
    }
    await row.getByRole('button', { name: committed ? '重试' : 'Retry', exact: true }).click()
    await expect(row).toHaveAttribute('data-state', 'complete')
    expect(allocations).toHaveLength(1)
    expect(transfers).toHaveLength({ 'committed': 1, 'disconnected': 2, 'csrf-renewal': 3 }[outcome])
    if (!committed) {
      expect(transfers[1]).toBe(transfers[0])
    }
    await expect(row).toContainText('13 B')
    await page.screenshot({ path: info.outputPath(`media-transfer-recovered-${outcome}.png`) })
    await dialog.getByRole('button', { name: committed ? '关闭' : 'Close', exact: true }).click()
    const list = assetListSchema.parse(await (await page.request.get('/api/admin/assets')).json())
    expect(list.items.filter(asset => asset.filename === filename && asset.state === 'ready')).toHaveLength(1)
  })
}
