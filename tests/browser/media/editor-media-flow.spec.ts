import { assertAccessible } from '~/tests/support/browser/accessibility'
import { saved, writeDocument } from '~/tests/support/browser/document'
import { fixture } from '~/tests/support/browser/document-fixture'
import { settingsTab } from '~/tests/support/browser/settings'
import { expect, test } from '~/tests/support/browser/test'
import { chooseImage, editFirstImage, editorDocument, firstImage, uploadFile } from './editor-media-flow-helpers'

for (const width of [390, 1440]) {
  test(`media replacement preserves the block and descriptions at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 })
    await writeDocument(page, fixture('Media placement anchor'))
    const prefix = `${width}-${crypto.randomUUID()}`
    const file = { name: `original-${prefix}.png`, mimeType: 'image/png', buffer: await page.screenshot() }
    await page.getByRole('button', { name: 'Add media', exact: true }).click()
    const add = page.getByRole('dialog', { name: 'Add media', exact: true })
    await uploadFile(add, file)
    await add.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(add).toHaveCount(0)
    await saved(page)
    const original = (await editorDocument(page)).document
    const media = firstImage(original)
    const edit = await editFirstImage(page, true)
    await expect(edit.getByLabel('Transcript', { exact: true })).toHaveCount(0)
    await expect(edit.getByRole('combobox', { name: 'Video captions', exact: true })).toHaveCount(0)
    await edit.getByLabel('Alternative text', { exact: true }).fill('Description belongs to this block')
    await uploadFile(edit, { ...file, name: `replacement-${prefix}.png`, buffer: await page.screenshot() })
    await edit.getByRole('button', { name: 'Close', exact: true }).click()
    await saved(page)
    const replaced = (await editorDocument(page)).document
    expect(replaced.blocks.map(block => block.id)).toEqual(original.blocks.map(block => block.id))
    expect(replaced.blocks.filter(block => block.type === 'image')).toHaveLength(1)
    expect(replaced.mediaAccessibility[media.id]?.alt).toBe('Description belongs to this block')
    expect(firstImage(replaced).props.url).not.toBe(media.props.url)
    await chooseImage(await editFirstImage(page), file.name)
    await saved(page)
    const reused = (await editorDocument(page)).document
    expect(reused.blocks.map(block => block.id)).toEqual(original.blocks.map(block => block.id))
    expect(firstImage(reused).props.url).toBe(media.props.url)
    expect(reused.mediaAccessibility[media.id]?.alt).toBe('Description belongs to this block')
    await page.reload()
    const details = await editFirstImage(page)
    await expect(details.getByLabel('Alternative text', { exact: true }))
      .toHaveValue('Description belongs to this block')
    await assertAccessible(page, info, { label: `media-details-${width}` })
    await page.screenshot({ path: info.outputPath('media-block-details.png') })
    await details.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(details).toHaveCount(0)
    await settingsTab(page, 'Content')
    await expect(page.getByRole('tab', { name: 'Media', exact: true })).toHaveCount(0)
  })

  test(`slash image opens media sources and fills its original placeholder at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await writeDocument(page, fixture(''))
    const original = (await editorDocument(page)).document
    const image = {
      name: `slash-image-${width}-${crypto.randomUUID()}.png`,
      mimeType: 'image/png',
      buffer: await page.screenshot(),
    }
    const body = page.getByLabel('Document body', { exact: true })
    await body.focus()
    await page.keyboard.type('/image')
    await expect(page.getByRole('option', { name: /^Image / })).toBeVisible()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'Add media', exact: true })
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await body.locator('.bn-add-file-button').click()
    await expect(dialog).toBeVisible()
    await uploadFile(dialog, image)
    await dialog.getByRole('button', { name: 'Close', exact: true }).click()
    await saved(page)
    const after = (await editorDocument(page)).document
    const media = after.blocks.filter(block => block.type === 'image')
    expect(media).toHaveLength(1)
    expect(media[0]?.id).toBe(original.blocks[0]?.id)
    expect(media[0]?.props.url).toMatch(/^\/assets\//)
    await expect(body.locator('.bn-add-file-button')).toHaveCount(0)
  })
}
