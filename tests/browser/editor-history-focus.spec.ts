import { expect, test } from '@playwright/test'
import { historyEditor, holdSave } from './editor-history-helpers'
import { saved } from './helpers'

for (const menu of [false, true]) {
  test(`mobile cancellation returns to the ${menu ? 'menu trigger' : 'edited title'}`, async ({ page }) => {
    await historyEditor(page, 'back')
    await page.setViewportSize({ width: 320, height: 900 })
    const release = await holdSave(page)
    const title = page.getByRole('textbox', { name: 'Title', exact: true })
    await title.fill('Continue typing after cancelling')
    const trigger = page.locator('.workspace-navigation-mobile')
    if (menu) {
      await trigger.click()
      await page.getByRole('menuitem', { name: 'Tags', exact: true }).click()
    }
    else {
      await page.evaluate(() => history.back())
    }
    const dialog = page.getByRole('dialog', { name: 'Saving before leaving', exact: true })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Stay here', exact: true }).click()
    await expect(menu ? trigger : title).toBeFocused()
    release()
    await saved(page)
    await expect(dialog).toHaveCount(0)
  })
}
