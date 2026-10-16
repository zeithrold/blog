import { expect, test } from '~/tests/support/browser/test'
import { openSourceFixture, persistedSource, selectSourceBlock, sourceText } from './source-input-helpers'

for (const kind of ['math', 'mermaid'] as const) {
  test(`typing on a selected ${kind} preserves every character and the block`, async ({ page }) => {
    const { body, block } = await openSourceFixture(page, kind)
    await selectSourceBlock(page, body)
    await page.keyboard.type('+q')
    await expect(block).toBeVisible()
    await expect(block.locator('.bn-preview-with-source-popup')).toHaveAttribute('data-open', 'true')
    await expect(block.locator('code')).toHaveText(`${sourceText[kind]}+q`)
    await expect(body.locator('[data-content-type="paragraph"]')).toHaveText('Keep this paragraph')
  })
  test(`Delete at the end of ${kind} source preserves the following paragraph`, async ({ page }) => {
    const { body, block, initial } = await openSourceFixture(page, kind)
    await block.getByRole('button', { name: kind === 'math' ? 'Edit formula' : 'Edit diagram', exact: true }).click()
    await expect(block.locator('.bn-preview-with-source-popup')).toHaveAttribute('data-open', 'true')
    await expect(body).toBeFocused()
    await page.keyboard.press('Delete')
    await expect(body.locator('[data-content-type="paragraph"]')).toHaveText('Keep this paragraph')
    expect((await persistedSource(page, initial.documentId)).blocks).toHaveLength(2)
    await expect(block.locator('code')).toHaveText(sourceText[kind])
  })
}
