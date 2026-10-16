import { tableDocument } from '~/tests/browser/editor/tables/table-overlay-helpers'
import { saved, writeDocument } from '~/tests/support/browser/document'
import { fixture } from '~/tests/support/browser/document-fixture'
import { expect, test } from '~/tests/support/browser/test'

for (const surface of ['block', 'colors'] as const) {
  for (const target of ['title', 'settings'] as const) {
    test(`desktop ${surface} menu outside click keeps the ${target} focus`, async ({ page }, info) => {
      const errors: string[] = []
      page.on('pageerror', error => errors.push(error.message))
      await page.setViewportSize({ width: 1440, height: 1000 })
      const document = surface === 'block' ? tableDocument() : fixture('Selected phrase')
      const original = await writeDocument(page, document)
      await openMenu(page, surface)
      const menu = surface === 'block'
        ? page.locator('.editor-desktop-block-actions')
        : page.getByRole('dialog', { name: 'Colors', exact: true })
      await expect(menu).toBeVisible()
      const field = page.getByRole('textbox', { name: target === 'title' ? 'Title' : 'Slug', exact: true })
      await field.click()
      await expect(menu).toHaveCount(0)
      await expect(field).toBeFocused()
      const addition = target === 'title' ? ' appended' : '-edited'
      const expected = await field.evaluate((element: HTMLInputElement, text) =>
        element.value.slice(0, element.selectionStart ?? 0) + text
        + element.value.slice(element.selectionEnd ?? 0), addition)
      await page.keyboard.type(addition)
      await expect(field).toHaveValue(expected)
      await saved(page)
      if (surface === 'block' && target === 'title') {
        await page.screenshot({ path: info.outputPath('outside-click-title-focus.png') })
      }
      const current: unknown = await (await page.request.get(`/api/admin/documents/${original.documentId}`)).json()
      expect(current).toMatchObject({ document: { meta: {
        [target === 'title' ? 'title' : 'slug']: expected,
      } } })
      expect(errors).toEqual([])
    })
  }
}

async function openMenu(page: import('@playwright/test').Page, surface: 'block' | 'colors'): Promise<void> {
  const body = page.getByLabel('Document body', { exact: true })
  if (surface === 'block') {
    await body.locator('table').getByText('First cell', { exact: true }).hover()
    await page.getByRole('button', { name: 'Open block menu', exact: true }).click()
    return
  }
  await body.focus()
  await body.evaluate((element) => {
    const node = document.createTreeWalker(element, NodeFilter.SHOW_TEXT).nextNode()
    if (node === null) {
      throw new Error('Missing selectable text')
    }
    window.getSelection()?.setBaseAndExtent(node, 0, node, 8)
    document.dispatchEvent(new Event('selectionchange'))
  })
  await page.getByRole('toolbar', { name: 'Formatting', exact: true })
    .getByRole('button', { name: 'Colors', exact: true })
    .click()
}
