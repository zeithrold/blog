import type { OpenDocument } from '@/contracts/documents'
import type { History } from '@/features/history/history-page-model'
import type { ApiCall, ApiService } from '~/tests/components/support/http-fixtures'
import { historyCopy } from '~/tests/components/support/history-copy'
import {
  appendedHistory,
  historyCase,
  historyReads,
  openDocument,
  restoredInto,
} from '~/tests/components/support/history-fixtures'
import { chooseRevision, confirmAction, mountHistory } from '~/tests/components/support/history-surface'
import { lostResponse, serveApi } from '~/tests/components/support/http-fixtures'
import { expect, test } from '~/tests/components/support/test'

function writes(api: ApiService): ApiCall[] {
  return api.calls.filter(call => call.method === 'POST')
}

// The page reports a committed restore whose answer was lost as an unknown result,
// then refreshes until the stored history agrees. Nine rounds keep the manual key
// budget honest: a confirmed version advance retires the pending key, so the ninth
// attempt is a new write rather than a failure of the eight-key cap. What the server
// did with those nine writes is proved against real D1 in the integration layer; this
// case owns the page's notices, locked controls and stale-to-refreshed sequence.
test('history reconciles an unknown restore result before allowing another mutation', async ({ page }) => {
  const copy = historyCopy.en
  const fixture = historyCase()
  let stored: OpenDocument = fixture.initial
  let revisions: History = fixture.history
  const keys: string[] = []
  const api = await serveApi(page, {
    ...historyReads(fixture),
    'GET /api/admin/documents/:id': () => ({ body: stored }),
    'GET /api/admin/documents/:id/revisions': () => ({ body: revisions }),
    'POST /api/admin/documents/:id/restore': (call) => {
      keys.push(call.headers['idempotency-key'] ?? '')
      // The server commits the restore, then the answer is lost on the way back.
      const restored = restoredInto(revisions, fixture.first)
      stored = openDocument(fixture, {
        version: stored.version + 1,
        headRevisionId: restored.revisionId,
        document: fixture.first.document,
      })
      revisions = appendedHistory(revisions, restored)
      return lostResponse()
    },
  })
  try {
    await mountHistory(page)
    await chooseRevision(page, copy, false, fixture.first.sequence)
    for (let attempt = 1; attempt <= 9; attempt++) {
      const expectedVersion = stored.version
      await confirmAction(page, copy, 'restore')
      const alert = page.getByRole('alert')
      await expect(alert).toContainText(copy.outcomeUnknown)
      await expect(page.getByRole('button', { name: copy.restore, exact: true })).toBeDisabled()
      await expect(page.getByRole('status').filter({ hasText: copy.restored })).toHaveCount(0)
      const calls = writes(api)
      expect(calls).toHaveLength(attempt)
      expect(calls[attempt - 1]?.json).toEqual({
        expectedVersion,
        revisionId: fixture.first.revisionId,
      })
      await page.getByRole('button', { name: copy.refresh, exact: true }).click()
      await expect(alert).toHaveCount(0)
      await expect(page.getByRole('combobox', { name: copy.compare, exact: true }))
        .toContainText(`${copy.revision} ${3 + attempt}`)
    }
    // Every round carried its own key: the pending-key budget of one client never ran out.
    expect(keys).toHaveLength(9)
    expect(keys.every(key => key !== '')).toBe(true)
    expect(new Set(keys).size).toBe(9)
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})
