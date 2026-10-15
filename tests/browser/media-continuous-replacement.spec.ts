import { expect, test } from '@playwright/test'
import { chooseImage, editFirstImage, editorDocument, firstImage, uploadFile } from './editor-media-flow-helpers'
import { saved, writeDocument } from './helpers'
import { fixture } from './preview-history-helpers'

for (const source of ['upload', 'library'] as const) {
  test(`consecutive ${source} replacements keep the same media block within one editing window`, async ({ page }) => {
    await writeDocument(page, fixture('Consecutive replacements'))
    const file = { name: `original-${crypto.randomUUID()}.png`, mimeType: 'image/png', buffer: await page.screenshot() }
    await page.getByRole('button', { name: 'Add media', exact: true }).click()
    const add = page.getByRole('dialog', { name: 'Add media', exact: true })
    await uploadFile(add, file)
    await add.getByRole('button', { name: 'Close', exact: true }).click()
    await saved(page)
    const before = (await editorDocument(page)).document
    const edit = await editFirstImage(page)
    await edit.getByLabel('Alternative text', { exact: true }).fill('Keep the block description')
    await uploadFile(edit, { ...file, name: `first-replacement-${crypto.randomUUID()}.png` })
    const finalName = source === 'upload' ? `second-replacement-${crypto.randomUUID()}.png` : file.name
    if (source === 'upload') {
      await uploadFile(edit, { ...file, name: finalName })
      await edit.getByRole('button', { name: 'Close', exact: true }).click()
    }
    else {
      await chooseImage(edit, file.name)
    }
    await saved(page)
    const after = (await editorDocument(page)).document
    expect(after.blocks.map(block => block.id)).toEqual(before.blocks.map(block => block.id))
    expect(after.blocks.filter(block => block.type === 'image')).toHaveLength(1)
    expect(firstImage(after).props).toMatchObject({ name: finalName })
    const originalURL = firstImage(before).props.url
    const finalURL = firstImage(after).props.url
    expect(finalURL === originalURL).toBe(source === 'library')
    expect(after.mediaAccessibility[firstImage(before).id]?.alt).toBe('Keep the block description')
  })
}
