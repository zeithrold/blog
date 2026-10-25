import type { Page } from '@playwright/test'
import type { HistoryCopy } from '~/tests/components/support/history-copy'
import { historyCopy } from '~/tests/components/support/history-copy'
import { historyCase, historyReads, savedElsewhere } from '~/tests/components/support/history-fixtures'
import { mountHistory } from '~/tests/components/support/history-surface'
import { failure, serveApi } from '~/tests/components/support/http-fixtures'
import { expect, test } from '~/tests/components/support/test'

/** The same comparison Select the retained E2E case reads, on a real component. */
async function expectBaseline(page: Page, copy: HistoryCopy, sequence: number): Promise<void> {
  const selection = page.getByRole('combobox', { name: copy.compare, exact: true })
  await expect(selection).toContainText(`${copy.revision} ${sequence}`)
  await expect(selection).toContainText(copy.currentDraft)
  await selection.click()
  await expect(page.getByRole('option', { name: new RegExp(`^${copy.revision} ${sequence} .*${copy.currentDraft}$`) }))
    .toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('Escape')
  await expect(selection).toBeFocused()
}

test(
  'history CAS conflict refreshes the baseline and preserves the selected revision for explicit retry',
  async ({ page }) => {
    const copy = historyCopy.en
    const fixture = historyCase()
    const external = savedElsewhere(fixture, 'Another tab changed the draft')
    let documentReads = 0
    let revisionReads = 0
    const api = await serveApi(page, {
      ...historyReads(fixture),
      // Another tab committed a newer head before this restore reached the server.
      'GET /api/admin/documents/:id': () => {
        documentReads += 1
        return { body: documentReads === 1 ? fixture.initial : external.initial }
      },
      'GET /api/admin/documents/:id/revisions': () => {
        revisionReads += 1
        return { body: revisionReads === 1 ? fixture.history : external.history }
      },
      'POST /api/admin/documents/:id/restore': () => failure(409, 'EDIT_CONFLICT'),
    })
    try {
      await mountHistory(page)
      await page.getByRole('button', { name: new RegExp(`^${copy.revision} ${fixture.first.sequence} `) }).click()
      await page.getByRole('button', { name: copy.restore, exact: true }).click()
      await page.getByRole('dialog').getByRole('button', { name: copy.confirm, exact: true }).click()
      await expect(page.getByRole('status').filter({ hasText: copy.conflict })).toBeVisible()
      await expect(page.locator('.history-selection'))
        .toHaveAttribute('data-selected-revision', fixture.first.revisionId)
      await expectBaseline(page, copy, external.revision.sequence)
      // The conflict was answered by refreshing, not by repeating the refused write.
      const writes = api.calls.filter(call => call.method === 'POST')
      expect(writes.map(call => call.json)).toEqual([
        { expectedVersion: fixture.initial.version, revisionId: fixture.first.revisionId },
      ])
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  },
)
