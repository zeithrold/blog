import { saved } from '~/tests/support/browser/document'
import {
  blockMenuTrigger,
  desktopMenu,
  openTableWorkspace,
  overlayTable,
} from '../support/editor-overlay-fixtures'
import { expect, test } from '../support/test'

test('Escape returns to the body when the open block menu trigger has focus', async ({ page }) => {
  const { api } = await openTableWorkspace(page, { title: 'Overlay reopen' })
  try {
    const body = page.getByLabel('Document body', { exact: true })
    await overlayTable(page).getByText('First cell', { exact: true }).hover()
    const trigger = blockMenuTrigger(page)
    await trigger.click()
    const menu = desktopMenu(page)
    await expect(menu.getByRole('button', { name: 'Delete', exact: true })).toBeFocused()
    await trigger.focus()
    await expect(menu).toBeVisible()
    await expect(trigger).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)
    await expect(body).toBeFocused()
    await saved(page)
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})
