import { expect, test } from '~/tests/support/browser/test'
import { openSourceFixture, persistedSource, sourceText } from './source-input-helpers'

const kind = 'math' as const

// The one retained source persistence representative: the client cases prove the input rules on
// the real editor, and this case proves the same edit reaches the Worker and leaves the stored
// document with both blocks.
test('Delete at the end of a math source preserves the following paragraph', async ({ page }) => {
  const { body, block, initial } = await openSourceFixture(page, kind)
  await block.getByRole('button', { name: 'Edit formula', exact: true }).click()
  await expect(block.locator('.bn-preview-with-source-popup')).toHaveAttribute('data-open', 'true')
  await expect(body).toBeFocused()
  await page.keyboard.press('Delete')
  await expect(body.locator('[data-content-type="paragraph"]')).toHaveText('Keep this paragraph')
  expect((await persistedSource(page, initial.documentId)).blocks).toHaveLength(2)
  await expect(block.locator('code')).toHaveText(sourceText[kind])
})
