import { historyDocument, historyEditor, holdSave } from '~/tests/browser/history/editor-history-helpers'
import { assertAccessible } from '~/tests/support/browser/accessibility'
import { expect, test } from '~/tests/support/browser/test'

for (const direction of ['back', 'forward'] as const) {
  test(`browser ${direction} saves the editor before restoring the original history entry`, async ({ page }, info) => {
    const pageErrors: string[] = []
    page.on('pageerror', error => pageErrors.push(error.message))
    const original = await historyEditor(page, direction)
    await info.attach('history-capabilities', {
      body: JSON.stringify(await page.evaluate(() => ({ navigation: 'navigation' in window }))),
      contentType: 'application/json',
    })
    const release = await holdSave(page)
    await page.getByRole('textbox', { name: 'Title', exact: true }).fill(`Edited before ${direction}`)
    await page.evaluate(value => history.go(value === 'back' ? -1 : 1), direction)
    const dialog = page.getByRole('dialog', { name: 'Saving before leaving', exact: true })
    await expect(dialog).toBeVisible({ timeout: 2000 })
    await expect(page).toHaveURL(new RegExp(`/admin/documents/${original.documentId}$`))
    expect(await page.evaluate(() => history.length)).toBe(original.length)
    await expect(dialog).toHaveCSS('opacity', '1')
    await assertAccessible(page, info, { label: `history-saving-${direction}` })
    await page.screenshot({ path: info.outputPath(`history-saving-${direction}.png`) })
    release()
    await expect(page.getByRole('heading', { name: direction === 'back' ? 'Documents' : 'Tags', exact: true }))
      .toBeVisible()
    const current = await historyDocument(page, original.documentId)
    expect(current.document.meta.title).toBe(`Edited before ${direction}`)
    expect(await page.evaluate(() => history.length)).toBe(original.length)
    await (direction === 'back' ? page.goForward() : page.goBack())
    await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(`Edited before ${direction}`)
    expect(pageErrors).toEqual([])
  })
}
