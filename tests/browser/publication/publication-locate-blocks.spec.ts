import type { Page } from '@playwright/test'
import { fixture } from '~/tests/browser/editor/blocks/block-action-helpers'
import { writeDocument } from '~/tests/support/browser/document'
import { expect, test } from '~/tests/support/browser/test'

for (const width of [1440, 320]) {
  test(`publication locates nested media and its diagram editing control at ${width}px`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.setViewportSize({ width, height: 900 })
    const document = fixture(30)
    const fileId = crypto.randomUUID()
    const diagramId = crypto.randomUUID()
    document.blocks.push({
      id: crypto.randomUUID(),
      type: 'callout',
      props: { tone: 'info' },
      content: [],
      children: [
        {
          id: fileId,
          type: 'file',
          props: { url: '', name: '', caption: '', backgroundColor: 'default' },
          children: [],
        },
      ],
    }, {
      id: diagramId,
      type: 'mermaid',
      props: { description: '' },
      content: [
        { type: 'text', text: 'Unsupported diagram', styles: {} },
      ],
      children: [],
    })
    document.mediaAccessibility[fileId] = {
      alt: '',
      decorative: false,
      transcript: '',
      captionAssetId: null,
      posterAssetId: null,
    }
    await writeDocument(page, document)
    await page.getByRole('button', { name: 'Publish', exact: true }).click()
    const notice = page.getByRole('region', { name: 'Publication checks failed', exact: true })
    await notice.getByRole('button', { name: /^Locate issue: Select a file/ }).click()
    const file = page.locator(`[data-node-type="blockContainer"][data-id="${fileId}"]`)
    await expect(file.locator('.ProseMirror-selectednode')).toHaveCount(1)
    await expect(file).toBeInViewport()
    await expect(page.getByRole('textbox', { name: 'Document body', exact: true })).toBeFocused()
    await page.getByRole('button', { name: 'Edit media', exact: true }).click()
    const media = page.getByRole('dialog', { name: 'Add media', exact: true })
    await expect(media).toBeVisible()
    await media.getByRole('tab', { name: 'Upload files', exact: true }).click()
    await expect(media.locator('input[type="file"]')).toHaveCount(1)
    await media.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(media).toHaveCount(0)
    await notice.getByRole('button', { name: /^Locate issue: Fix empty/ }).click()
    const edit = page.locator(`[data-id="${diagramId}"]`).getByRole('button', { name: 'Edit diagram', exact: true })
    await expect(edit).toBeFocused()
    await expect(edit).toBeInViewport()
    await edit.press('Enter')
    await expectSourceCursor(page)
    expect(errors).toEqual([])
  })
}

async function expectSourceCursor(page: Page): Promise<void> {
  const source = page.getByRole('textbox', { name: 'Diagram source', exact: true })
  await expect(source).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Document body', exact: true })).toBeFocused()
  expect(await source.evaluate(element => element.contains(window.getSelection()?.anchorNode ?? null))).toBe(true)
}

test('server-only publication reasons remain visible without a matching local block', async ({ page }) => {
  const document = fixture(1)
  await writeDocument(page, document)
  await page.route('**/publish', async route => await route.fulfill({
    status: 422,
    json: { code: 'PUBLICATION_INVALID', issues: ['image'] },
  }))
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  const notice = page.getByRole('region', { name: 'Publication checks failed', exact: true })
  await expect(notice.getByRole('listitem')).toHaveText(['Add image alternative text or mark the image as decorative.'])
  await expect(notice.getByRole('button')).toHaveCount(0)
  await expect(notice).toBeFocused()
})
