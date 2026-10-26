import { deferOverlayClose } from '~/tests/support/browser/overlay-close-probe'
import { expect, test } from '~/tests/support/browser/test'
import { linkFixture, openKeyboardLink, selectLinkPhrase } from './link-keyboard-helpers'

// The one routed overlay-close representative: only the built application changes the page
// under a pending close, so the released close must leave the tags form input untouched.
test('a delayed dialog link close leaves the destination input alone', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const body = await linkFixture(page, 'en', 390)
  await selectLinkPhrase(page, body)
  await deferOverlayClose(page, '.editor-link-command')
  await openKeyboardLink(page, 'en', 'Meta')
  await page.getByRole('dialog', { name: 'Create link', exact: true })
    .getByRole('button', { name: 'Cancel', exact: true })
    .click()
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
