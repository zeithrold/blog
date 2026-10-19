import { openDocumentSchema } from '@/contracts/documents'
import { writeDocument } from '~/tests/support/browser/document'
import { fixture } from '~/tests/support/browser/document-fixture'
import { horizontalBounds } from '~/tests/support/browser/layout'
import { expect, test } from '~/tests/support/browser/test'

test('desktop text and highlight matrices preserve the selected range and native styles', async ({ page }, info) => {
  const selected = 'Selected phrase'
  const suffix = ' untouched suffix'
  const ack = await writeDocument(page, fixture(`${selected}${suffix}`))
  const body = page.getByLabel('Document body', { exact: true })
  await body.focus()
  await body.evaluate((element, length) => {
    const node = document.createTreeWalker(element, NodeFilter.SHOW_TEXT).nextNode()
    if (node === null) {
      throw new Error('Missing selectable text')
    }
    window.getSelection()?.setBaseAndExtent(node, 0, node, length)
    document.dispatchEvent(new Event('selectionchange'))
  }, selected.length)
  const toolbar = page.getByRole('toolbar', { name: 'Formatting', exact: true })
  await toolbar.getByRole('button', { name: 'Colors', exact: true }).click()
  const colors = page.getByRole('dialog', { name: 'Colors', exact: true })
  await expect(colors).toBeVisible()
  await horizontalBounds(page, colors)
  const text = colors.locator('[data-color-kind="text"]')
  const background = colors.locator('[data-color-kind="background"]')
  await expect(text.getByRole('button')).toHaveCount(10)
  await expect(background.getByRole('button')).toHaveCount(10)
  const columns = await text.getByRole('button').evaluateAll(buttons => new Set(
    buttons.map(button => Math.round(button.getBoundingClientRect().x)),
  ).size)
  expect(columns).toBe(5)
  await text.locator('[data-test="text-color-blue"]').click()
  await background.locator('[data-test="background-color-yellow"]').click()
  await expect(text.locator('[data-test="text-color-blue"]')).toHaveAttribute('aria-pressed', 'true')
  await expect(background.locator('[data-test="background-color-yellow"]')).toHaveAttribute('aria-pressed', 'true')
  await page.screenshot({ path: info.outputPath('desktop-text-color-matrices.png') })
  await page.keyboard.press('Escape')
  await expect(colors).not.toBeVisible()
  await expect(body).toBeFocused()
  await expect.poll(async () => {
    const response = await page.request.get(`/api/admin/documents/${ack.documentId}`)
    return openDocumentSchema.parse(await response.json()).document.blocks[0]?.content
  }, { timeout: 15000 }).toEqual([
    { type: 'text', text: selected, styles: { textColor: 'blue', backgroundColor: 'yellow' } },
    { type: 'text', text: suffix, styles: {} },
  ])
  await page.reload()
  await expect(body).toHaveText(`${selected}${suffix}`)
})
