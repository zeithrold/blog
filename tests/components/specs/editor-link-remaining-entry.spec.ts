import { assertAccessible } from '~/tests/support/browser/accessibility'
import {
  expectPacketContent,
  formattingCopy,
  linkSelected,
  selectRange,
} from '../support/editor-formatting-fixtures'
import {
  linkedContent,
  linkSelection,
  openLinkWorkspace,
} from '../support/editor-link-remaining-fixtures'
import { expect, test } from '../support/test'

test.describe('touch link entry', () => {
  test.use({ hasTouch: true })

  test('the mobile formatting drawer hands a touch selection to the link dialog in dark zh', async ({ page }, info) => {
    const copy = formattingCopy.zh
    const href = '/posts/touch-selection'
    const { api, body } = await openLinkWorkspace(page, { locale: 'zh', width: 390, mode: 'dark' })
    try {
      await selectRange(page, body, linkSelection, linkSelected)
      await page.getByRole('button', { name: copy.more, exact: true }).tap()
      await page.getByRole('dialog', { name: copy.drawer, exact: true })
        .getByRole('button', { name: copy.dialog, exact: true })
        .tap()
      const dialog = page.getByRole('dialog', { name: copy.dialog, exact: true })
      await expect(dialog).toBeVisible()
      const url = dialog.getByRole('textbox', { name: copy.url, exact: true })
      await expect(url).toBeFocused()
      await assertAccessible(page, info, { label: 'touch-link-dialog-dark-zh' })
      await url.pressSequentially(href)
      await dialog.getByRole('button', { name: copy.save, exact: true }).tap()
      await expect(dialog).toHaveCount(0)
      await expect(body).toBeFocused()
      await expect(body).toHaveText('Before Selected link untouched suffix')
      await expect(body.locator('a')).toHaveCount(1)
      await expect(body.locator('a')).toHaveText(linkSelected)
      await expect(body.locator('a')).toHaveAttribute('href', href)
      await api.expectServed()
      await expectPacketContent(api, linkedContent(href))
    }
    finally {
      await api.dispose()
    }
  })
})
