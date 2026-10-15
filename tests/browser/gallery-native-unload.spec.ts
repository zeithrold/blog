import { Buffer } from 'node:buffer'
import { expect, test } from '@playwright/test'

test('native tab close warns about a hidden gallery queue and cancellation retains its file', async ({ page }) => {
  await page.goto('/__fixture/login')
  await page.goto('/admin/media')
  await page.getByRole('button', { name: 'Upload media', exact: true }).click()
  const name = `native-unload-${crypto.randomUUID()}.txt`
  await page.getByLabel('Media file', { exact: true }).setInputFiles({
    name,
    mimeType: 'text/plain',
    buffer: Buffer.from('Keep through cancelled reload'),
  })
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByRole('link', { name: 'Tags', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Tags', exact: true })).toBeVisible()
  const prompt = page.waitForEvent('dialog')
  const closing = page.close({ runBeforeUnload: true })
  const dialog = await prompt
  expect(dialog.type()).toBe('beforeunload')
  await dialog.dismiss()
  await closing
  expect(page.isClosed()).toBe(false)
  await expect(page.getByRole('heading', { name: 'Tags', exact: true })).toBeVisible()
  await page.goBack()
  await page.getByRole('button', { name: 'Upload media', exact: true }).click()
  const upload = page.getByRole('dialog', { name: 'Upload media', exact: true })
  await expect(upload.getByRole('listitem').filter({ hasText: name })).toHaveAttribute('data-state', 'queued')
  await upload.getByRole('button', { name: 'Remove file', exact: true }).click()
  await upload.getByRole('button', { name: 'Close', exact: true }).click()
  const dialogs: string[] = []
  page.on('dialog', (event) => {
    dialogs.push(event.type())
    event.dismiss().catch(() => {})
  })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Gallery', exact: true })).toBeVisible()
  expect(dialogs).toEqual([])
})
