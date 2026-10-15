import { expect, test } from '@playwright/test'
import { historyDocument, historyEditor } from './editor-history-helpers'
import { saved } from './helpers'

test('a file drop during composition stays in the tracked upload pipeline', async ({ page }) => {
  const original = await historyEditor(page, 'back')
  const bytes = Array.from(await page.screenshot({ type: 'png' }))
  let release = (): void => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  let started = (): void => {}
  const uploading = new Promise<void>((resolve) => {
    started = resolve
  })
  await page.route('**/api/admin/assets/*/content', async (route) => {
    if (route.request().method() === 'PUT') {
      started()
      await held
    }
    await route.continue()
  })
  const body = page.getByLabel('Document body', { exact: true })
  await body.evaluate((element, input) => {
    const box = element.getBoundingClientRect()
    element.dispatchEvent(new CompositionEvent('compositionstart', { data: '', bubbles: true }))
    const dataTransfer = new DataTransfer()
    dataTransfer.items.add(new File([
      new Uint8Array(input),
    ], 'native-history.png', { type: 'image/png' }))
    element.dispatchEvent(new DragEvent('drop', {
      dataTransfer,
      bubbles: true,
      cancelable: true,
      clientX: box.left + 20,
      clientY: box.top + 10,
    }))
  }, bytes)
  await uploading
  await expect(page.locator('.bn-editor [data-content-type="image"]')).toHaveCount(0)
  await body.evaluate((element) => {
    element.dispatchEvent(new CompositionEvent('compositionend', { data: '', bubbles: true }))
    history.back()
  })
  const dialog = page.getByRole('dialog', { name: 'Saving before leaving', exact: true })
  await expect(dialog).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/admin/documents/${original.documentId}$`))
  release()
  await expect(page.getByRole('heading', { name: 'Documents', exact: true })).toBeVisible()
  const current = (await historyDocument(page, original.documentId)).document
  const image = current.blocks.find(block => block.type === 'image')
  expect(image?.props.url).toMatch(/^\/assets\//)
  expect(current.mediaAccessibility[image?.id ?? '']).toBeDefined()
  expect(await page.evaluate(() => history.length)).toBe(original.length)
})

test('a ready dropped file waits for composition to end before inserting its block', async ({ page }) => {
  const original = await historyEditor(page, 'back')
  const bytes = Array.from(await page.screenshot({ type: 'png' }))
  const uploaded = page.waitForResponse(response => response.request().method() === 'PUT'
    && response.url().endsWith('/content') && response.ok())
  const body = page.getByLabel('Document body', { exact: true })
  await body.evaluate((element, input) => {
    element.dispatchEvent(new CompositionEvent('compositionstart', { data: '', bubbles: true }))
    const dataTransfer = new DataTransfer()
    dataTransfer.items.add(new File([
      new Uint8Array(input),
    ], 'composing-ready.png', { type: 'image/png' }))
    element.dispatchEvent(new DragEvent('drop', { dataTransfer, bubbles: true, cancelable: true }))
  }, bytes)
  await uploaded
  await expect(page.locator('.bn-editor [data-content-type="image"]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled()
  await body.dispatchEvent('compositionend', { data: '', bubbles: true })
  await expect(page.locator('.bn-editor img')).toHaveCount(1)
  await saved(page)
  const current = (await historyDocument(page, original.documentId)).document
  const image = current.blocks.find(block => block.type === 'image')
  expect(current.mediaAccessibility[image?.id ?? '']).toBeDefined()
})
