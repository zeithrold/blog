import { documentEntry, documentsPage } from '~/tests/components/support/domain-fixtures'
import { documentsCopy } from '~/tests/components/support/expected-copy'
import { defer, serveApi, watchErrors } from '~/tests/components/support/http-fixtures'
import { mountSurface } from '~/tests/components/support/mount'
import { expect, test } from '~/tests/components/support/test'

// Readiness is the mounted surface, never network silence: a quiet network would
// wait for a list response the case deliberately never answers, and every case
// that reads a loading state would lose the state it is about.
test('mounting the list does not wait for the list response', async ({ page }) => {
  const entry = documentEntry({ title: `Readiness ${crypto.randomUUID()}` })
  const errors = watchErrors(page)
  const held = defer()
  const api = await serveApi(page, {
    'GET /api/admin/documents': async () => {
      await held.promise
      return { body: documentsPage([entry]) }
    },
  })
  try {
    await mountSurface(page, { surface: 'documents' })
    const copy = documentsCopy.en
    // Mount has returned although the only list request is still unanswered.
    await expect(page.getByRole('heading', { name: copy.title, exact: true })).toBeVisible()
    await expect(page.locator('.document-list-panel')).toHaveAttribute('aria-busy', 'true')
    await expect(page.locator('.document-loading').getByRole('status')).toHaveText(copy.loading)
    expect(api.calls).toHaveLength(1)

    held.open()
    await expect(page.getByRole('link', { name: entry.title, exact: true })).toBeVisible()
    await api.expectServed()
    errors.expectNone()
  }
  finally {
    held.open()
    await api.dispose()
  }
})
