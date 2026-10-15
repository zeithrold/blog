import { expect, test } from '@playwright/test'
import { linkFixture, openKeyboardLink, selectLinkPhrase } from './link-keyboard-helpers'
import { deferOverlayClose } from './overlay-close-probe'

for (const surface of ['dialog', 'drawer'] as const) {
  test(`a delayed ${surface} link close leaves the destination input alone`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    const body = await linkFixture(page, 'en', 390)
    await selectLinkPhrase(page, body)
    await deferOverlayClose(page, surface === 'dialog' ? '.editor-link-command' : '.formatting-options-drawer')
    if (surface === 'dialog') {
      await openKeyboardLink(page, 'en', 'Meta')
      await page.getByRole('dialog', { name: 'Create link', exact: true })
        .getByRole('button', { name: 'Cancel', exact: true })
        .click()
    }
    else {
      await page.getByRole('button', { name: 'More formatting options', exact: true }).click()
      await page.getByRole('dialog', { name: 'Formatting options', exact: true })
        .getByRole('button', { name: 'Create link', exact: true })
        .click()
    }
    await expect.poll(async () => await page.evaluate(() => window.overlayCloseProbe.count())).toBe(1)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.locator('.workspace-navigation-mobile').click()
    await page.getByRole('menuitem', { name: 'Tags', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Tags', exact: true })).toBeVisible()
    const name = page.getByRole('textbox', { name: 'Name', exact: true })
    await name.fill('Keep destination focus')
    const path = page.url()
    await page.evaluate(() => window.overlayCloseProbe.release())
    await expect(name).toBeFocused()
    await expect(name).toHaveValue('Keep destination focus')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(page.url()).toBe(path)
    expect(errors).toEqual([])
  })
}

test('an old link dialog close cannot take focus from the reopened editor', async ({ page }) => {
  const body = await linkFixture(page, 'en', 1440)
  await selectLinkPhrase(page, body)
  await deferOverlayClose(page, '.editor-link-command')
  await openKeyboardLink(page, 'en', 'Meta')
  const dialog = page.getByRole('dialog', { name: 'Create link', exact: true })
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect.poll(async () => await page.evaluate(() => window.overlayCloseProbe.count())).toBe(1)
  await selectLinkPhrase(page, body)
  const url = await openKeyboardLink(page, 'en', 'Meta')
  await url.fill('/posts/kept-input')
  await page.evaluate(() => window.overlayCloseProbe.release())
  await expect(url).toBeFocused()
  await expect(url).toHaveValue('/posts/kept-input')
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(body).toBeFocused()
})
