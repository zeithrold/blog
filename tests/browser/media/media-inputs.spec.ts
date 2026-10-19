import type { Page } from '@playwright/test'
import { openDocumentSchema } from '@/contracts/documents'
import { saved, writeDocument } from '~/tests/support/browser/document'
import { fixture } from '~/tests/support/browser/document-fixture'
import { expect, test } from '~/tests/support/browser/test'

async function insert(page: Page, bytes: number[], mode: 'paste' | 'drop'): Promise<void> {
  await page.getByLabel('Document body', { exact: true }).evaluate(
    (element, input) => {
      const data = new DataTransfer()
      data.items.add(
        new File([
          new Uint8Array(input.bytes),
        ], `${input.mode}.png`, { type: 'image/png' }),
      )
      const event
        = input.mode === 'paste'
          ? new ClipboardEvent('paste', {
              clipboardData: data,
              bubbles: true,
              cancelable: true,
            })
          : new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true })
      element.dispatchEvent(event)
    },
    { bytes, mode },
  )
}
test('file paste and drop wait for ready media and block publication during upload', async ({
  page,
}) => {
  await page.goto('/__fixture/login')
  await page.getByRole('button', { name: 'New post' }).click()
  await page.getByLabel('Title', { exact: true }).fill('Pasted media')
  await page.getByLabel('Slug', { exact: true }).fill('pasted-media')
  await page.getByLabel('Document body', { exact: true }).fill('Media anchor')
  await saved(page)
  const png = Array.from(await page.screenshot({ type: 'png' }))
  let release: (() => void) | undefined
  const hold = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/admin/assets/**', async (route) => {
    if (route.request().method() === 'PUT') {
      await hold
    }
    await route.continue()
  })
  await insert(page, png, 'paste')
  await expect(page.getByRole('button', { name: 'Publish' })).toBeDisabled()
  await expect(page.locator('.bn-editor img')).toHaveCount(0)
  release?.()
  await expect(page.locator('.bn-editor img')).toHaveCount(1)
  await page.unroute('**/api/admin/assets/**')
  await insert(page, png, 'drop')
  await expect(page.locator('.bn-editor img')).toHaveCount(2)
  await saved(page)
  const path = new URL(page.url()).pathname.replace(
    '/admin/documents/',
    '/api/admin/documents/',
  )
  const document = openDocumentSchema.parse(
    await (await page.request.get(path)).json(),
  ).document
  const media = document.blocks.filter(block => block.type === 'image')
  expect(media).toHaveLength(2)
  for (const block of media) {
    expect(block.props.url).toMatch(/^\/assets\/[0-9a-f-]{36}$/)
    expect(document.mediaAccessibility[block.id]).toBeDefined()
  }
})

for (const mode of ['paste', 'drop'] as const) {
  test(`native ${mode} upload warns before leaving until the media and draft are saved`, async ({ page }) => {
    await writeDocument(page, fixture(`Native ${mode} leave protection`))
    const png = Array.from(await page.screenshot({ type: 'png' }))
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
    await insert(page, png, mode)
    await uploading
    const guarded = await page.evaluate(() => {
      const event = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(event)
      return event.defaultPrevented
    })
    release()
    await expect(page.locator('.bn-editor img')).toHaveCount(1)
    await saved(page)
    expect(guarded).toBe(true)
    expect(await page.evaluate(() => {
      const event = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(event)
      return event.defaultPrevented
    })).toBe(false)
  })
}
