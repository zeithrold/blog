import { assertAccessible } from '~/tests/support/browser/accessibility'
import { saved, writeDocument } from '~/tests/support/browser/document'
import { fixture } from '~/tests/support/browser/document-fixture'
import { settingsTab } from '~/tests/support/browser/settings'
import { expect, test } from '~/tests/support/browser/test'
import { chooseImage, editFirstImage, uploadFile } from './editor-media-flow-helpers'

for (const width of [390, 1440]) {
  // The payload a replacement stores - block ids, media URLs and the description -
  // is asserted in tests/components/specs/editor-media.spec.ts. This case keeps the
  // one thing only the built app can prove: a real reload restores that description.
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
    const edit = await editFirstImage(page, true)
    await edit.getByLabel('Alternative text', { exact: true }).fill('Description belongs to this block')
    await uploadFile(edit, { ...file, name: `replacement-${prefix}.png`, buffer: await page.screenshot() })
    await edit.getByRole('button', { name: 'Close', exact: true }).click()
    await saved(page)
    await chooseImage(await editFirstImage(page), file.name)
    await saved(page)

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
}
