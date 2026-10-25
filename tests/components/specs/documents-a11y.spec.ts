import type { Page } from '@playwright/test'
import { acknowledgementFor, documentEntry, documentsPage } from '~/tests/components/support/domain-fixtures'
import { documentsCopy } from '~/tests/components/support/expected-copy'
import { defer, failure, serveApi } from '~/tests/components/support/http-fixtures'
import { mountSurface } from '~/tests/components/support/mount'
import { expect, test } from '~/tests/components/support/test'
import { assertAccessible } from '~/tests/support/browser/accessibility'

async function choose(page: Page, label: string, option: string): Promise<void> {
  await page.getByRole('combobox', { name: label, exact: true }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

// Both notices are announced at once when a confirmed restore cannot refresh the
// list: the alert takes focus, and the status reports what was committed.
test.describe('accessibility scanner', () => {
  test.use({ bypassCSP: true })
  for (const [locale, width, mode] of [
    [
      'en',
      1440,
      'light',
    ],
    [
      'zh',
      320,
      'dark',
    ],
  ] as const) {
    test(`restoration and refresh notices are accessible in ${locale} at ${width}px`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 })
      const target = documentEntry({ title: `Notice target ${crypto.randomUUID()}` })
      const other = documentEntry({ title: `Notice other ${crypto.randomUUID()}` })
      const held = defer()
      const captured = defer()
      let calls = 0
      const api = await serveApi(page, {
        'GET /api/admin/documents': async () => {
          calls += 1
          if (calls <= 2) {
            return { body: documentsPage([target, other]) }
          }
          captured.open()
          await held.promise
          return failure(503, 'UNAVAILABLE')
        },
        'POST /api/admin/documents/:id/restore-deleted': () => ({
          body: acknowledgementFor(target, { version: target.version + 1 }),
        }),
      })
      try {
        await mountSurface(page, { surface: 'documents', locale, mode })
        const copy = documentsCopy[locale]
        await choose(page, copy.state, copy.trash)
        const row = page.getByRole('list', { name: copy.title, exact: true })
          .getByRole('listitem')
          .filter({ hasText: target.title })
        await row.getByRole('button', { name: copy.restore, exact: true }).click()
        await captured.promise
        held.open()
        await expect(page.getByRole('alert')).toContainText(copy.loadError)
        await expect(page.getByRole('status').filter({ hasText: copy.restored })).toBeVisible()
        await assertAccessible(page, info, { label: `trash-notices-${locale}-${width}` })
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
        await page.screenshot({ path: info.outputPath(`trash-notices-${locale}-${width}.png`) })
        await api.expectServed()
      }
      finally {
        held.open()
        await api.dispose()
      }
    })
  }
})
