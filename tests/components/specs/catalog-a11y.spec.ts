import { catalogEntry, catalogPage } from '~/tests/components/support/domain-fixtures'
import { catalogCopy } from '~/tests/components/support/expected-copy'
import { serveApi } from '~/tests/components/support/http-fixtures'
import { mountSurface } from '~/tests/components/support/mount'
import { expect, test } from '~/tests/components/support/test'
import { assertAccessible } from '~/tests/support/browser/accessibility'

// Switching to another entry while the form is dirty is the component's own
// discard decision: the dialog has to be operable, translated, readable in the
// dark palette at the narrowest width, and it has to give focus back to the
// control that asked.
test.describe('accessibility scanner', () => {
  test.use({ bypassCSP: true })
  test('Chinese dark catalog editing keeps the draft and returns focus at 320px', async ({ page }, info) => {
    const unique = crypto.randomUUID()
    const first = catalogEntry({ kind: 'tag', name: `保留 A ${unique}`, slug: `keep-a-${unique}` })
    const second = catalogEntry({ kind: 'tag', name: `保留 B ${unique}`, slug: `keep-b-${unique}` })
    const local = '保留这份未保存修改'
    const api = await serveApi(page, {
      'GET /api/admin/catalog/tag': () => ({ body: catalogPage([first, second]) }),
    })
    try {
      await page.setViewportSize({ width: 320, height: 900 })
      await mountSurface(page, { surface: 'catalog-tag', locale: 'zh', mode: 'dark' })
      const copy = catalogCopy.zh
      await expect(page.getByRole('heading', { name: copy.tags, exact: true })).toBeVisible()
      await page.getByRole('button', { name: `${copy.edit} ${first.name}`, exact: true }).click()
      await page.getByLabel(copy.name, { exact: true }).fill(local)

      const trigger = page.getByRole('button', { name: `${copy.edit} ${second.name}`, exact: true })
      await trigger.click()
      const dialog = page.getByRole('dialog', { name: copy.discard, exact: true })
      await expect(dialog).toBeVisible()
      await expect(dialog).toContainText(copy.review)
      await assertAccessible(page, info, { label: 'catalog-discard-zh-dark-320' })
      await page.screenshot({ path: info.outputPath('catalog-discard-zh-dark-320.png') })

      await dialog.getByRole('button', { name: copy.cancel, exact: true }).click()
      await expect(dialog).toHaveCount(0)
      await expect(trigger).toBeFocused()
      await expect(page.getByLabel(copy.name, { exact: true })).toHaveValue(local)
      await assertAccessible(page, info, { label: 'catalog-draft-after-cancel-zh-dark-320' })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
})
