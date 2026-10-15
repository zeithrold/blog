import type { Page } from '@playwright/test'
import { Buffer } from 'node:buffer'
import { expect, test } from '@playwright/test'
import { assertAccessible } from './accessibility'
import { setChinese, withinViewport } from './block-action-helpers'
import { uploadFile } from './editor-media-flow-helpers'
import { saved, writeDocument } from './helpers'
import { fixture } from './preview-history-helpers'

async function prepareMedia(page: Page, width: number): Promise<string> {
  await writeDocument(page, fixture('Media library layout'))
  const name = `a-long-original-photo-filename-that-remains-readable-${width}.png`
  await page.getByRole('button', { name: 'Add media', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Add media', exact: true })
  await uploadFile(dialog, { name, mimeType: 'image/png', buffer: await page.screenshot() })
  await uploadFile(dialog, {
    name: `library-document-${width}.txt`,
    mimeType: 'text/plain',
    buffer: Buffer.from('A private file'),
  })
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await saved(page)
  return name
}

for (const width of [
  320,
  390,
  1440,
]) {
  const title = `media cards preserve previews, keyboard selection and accessible layout at ${width}px`
  test(title, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 })
    const filename = await prepareMedia(page, width)
    if (width === 320) {
      await page.getByRole('button', { name: 'Appearance', exact: true }).click()
      await page.getByRole('menuitemradio', { name: 'Dark', exact: true }).click()
    }
    const chinese = width < 1440
    if (chinese) {
      await setChinese(page)
    }
    await page.getByRole('button', { name: chinese ? '添加媒体' : 'Add media', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: chinese ? '添加媒体' : 'Add media', exact: true })
    await dialog.getByRole('tab', { name: chinese ? '媒体库' : 'Media library', exact: true }).click()
    const card = dialog.locator('.editor-media-card').filter({ hasText: filename })
    await expect(card.locator('img')).toBeVisible()
    await withinViewport(page, dialog)
    expect(await card.locator('img').evaluate(element => getComputedStyle(element).objectFit)).toBe('contain')
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
    const open = card.getByRole('link', { name: chinese ? '打开媒体' : 'Open media', exact: true })
    await expect(open).toHaveAttribute('target', '_blank')
    const use = card.getByRole('button', { name: chinese ? '使用此媒体' : 'Use media', exact: true })
    await use.focus()
    await expect(use).toBeFocused()
    await assertAccessible(page, info, { label: `media-picker-${width}` })
    await page.screenshot({ path: info.outputPath(`media-picker-${width}.png`) })
    await use.press('Enter')
    await expect(dialog).toHaveCount(0)
    await expect(page.getByLabel(chinese ? '正文' : 'Document body', { exact: true }).locator('img')).toHaveCount(2)
    await expect(page.getByRole('status').filter({ hasText: /^(?:Saved|已保存)$/ })).toBeVisible({ timeout: 15000 })
    await page.goto('/admin/media')
    await expect(page.getByRole('heading', { name: filename, exact: true })).toBeVisible()
    await expect(page.locator('.media-card').filter({ hasText: `library-document-${width}.txt` }))
      .toContainText('14 B')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await assertAccessible(page, info, { label: `media-gallery-${width}` })
    await page.screenshot({ path: info.outputPath(`media-gallery-${width}.png`), fullPage: true })
  })
}
