import { tableDocument } from '~/tests/browser/editor/tables/table-overlay-helpers'
import { saved, writeDocument } from '~/tests/support/browser/document'
import { expect, test } from '~/tests/support/browser/test'

test('Escape returns to the body when the open block menu trigger has focus', async ({ page }) => {
  await writeDocument(page, tableDocument())
  const body = page.getByLabel('Document body', { exact: true })
  await body.locator('table').getByText('First cell', { exact: true }).hover()
  const trigger = page.getByRole('button', { name: 'Open block menu', exact: true })
  await trigger.click()
  const menu = page.locator('.editor-desktop-block-actions')
  await expect(menu.getByRole('button', { name: 'Delete', exact: true })).toBeFocused()
  await trigger.focus()
  await expect(menu).toBeVisible()
  await expect(trigger).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await expect(body).toBeFocused()
  await saved(page)
})
