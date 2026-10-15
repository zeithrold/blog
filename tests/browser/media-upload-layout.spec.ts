import type { Locator, Page } from '@playwright/test'
import { Buffer } from 'node:buffer'
import { expect, test } from '@playwright/test'
import { writeDocument } from './helpers'
import { fixture, horizontalBounds, setLocale } from './preview-history-helpers'

async function assertPickerLayout(page: Page, dialog: Locator): Promise<void> {
  const picker = dialog.locator('.file-picker-control')
  await horizontalBounds(page, dialog)
  await horizontalBounds(page, picker)
  await expect(dialog.locator('input[type="file"]')).toHaveCSS('opacity', '0')
  await expect(dialog.locator('input[type="file"]')).toHaveCSS('position', 'absolute')
  await expect(picker).toHaveCSS('min-height', '44px')
  const geometry = await picker.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    const input = element.querySelector('input')?.getBoundingClientRect()
    const label = element.querySelector('span')?.getBoundingClientRect()
    return {
      width: bounds.width,
      height: bounds.height,
      fits: input !== undefined && input.left >= bounds.left && input.right <= bounds.right,
      labelHeight: label?.height,
      labelWidth: label?.width,
    }
  })
  expect(geometry.width).toBeLessThanOrEqual(240)
  expect(geometry.height).toBeLessThanOrEqual(48)
  expect(geometry.fits).toBe(true)
  expect(geometry.labelHeight).toBeLessThan(24)
  expect(geometry.labelWidth).toBeGreaterThan(48)
}

async function chooseFiles(page: Page, dialog: Locator): Promise<void> {
  const file = { name: 'picker-pointer.txt', mimeType: 'text/plain', buffer: Buffer.from('Pointer upload') }
  const pointer = page.waitForEvent('filechooser')
  await dialog.locator('.file-picker-control').click()
  await (await pointer).setFiles(file)
  const input = dialog.locator('input[type="file"]')
  await input.focus()
  const keyboard = page.waitForEvent('filechooser')
  await page.keyboard.press('Space')
  await (await keyboard).setFiles({ ...file, name: 'picker-keyboard.txt', buffer: Buffer.from('Keyboard upload') })
  await expect(dialog.locator('.media-upload-item')).toHaveCount(2)
}

for (const width of [
  320,
  682,
  1440,
]) {
  test(`upload picker stays compact and supports pointer and keyboard at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 740 })
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: width === 682 ? 'dark' : 'light' })
    await writeDocument(page, fixture(`Upload dialog layout at ${width}px`))
    const chinese = width !== 1440
    await setLocale(page, chinese ? 'zh' : 'en')
    await page.getByRole('button', { name: chinese ? '添加媒体' : 'Add media', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: chinese ? '添加媒体' : 'Add media', exact: true })
    await expect(dialog).toBeVisible()
    await assertPickerLayout(page, dialog)
    await page.screenshot({ path: info.outputPath('upload-dialog.png') })
    await chooseFiles(page, dialog)
    await dialog.getByRole('button', { name: chinese ? '上传文件' : 'Upload files', exact: true }).click()
    await expect(dialog.locator('.media-upload-item[data-state="complete"]')).toHaveCount(2, { timeout: 15000 })
    await dialog.getByRole('button', { name: chinese ? '关闭' : 'Close', exact: true }).click()
    await expect(dialog).toHaveCount(0)
  })
}
