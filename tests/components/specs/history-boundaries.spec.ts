import type { Acknowledgement, OpenDocument } from '@/contracts/documents'
import type { History } from '@/features/history/history-page-model'
import type { HistoryCase } from '~/tests/components/support/history-fixtures'
import { historyCopy } from '~/tests/components/support/history-copy'
import {
  appendedHistory,
  historyAcknowledgement,
  historyCase,
  historyReads,
  openDocument,
  restoredHead,
  savedElsewhere,
} from '~/tests/components/support/history-fixtures'
import {
  chooseRevision,
  confirmAction,
  expectRefreshRecovers,
  expectRefreshRequired,
  mountHistory,
} from '~/tests/components/support/history-surface'
import { expectRetriedWrite, failure, lostResponse, serveApi } from '~/tests/components/support/http-fixtures'
import { expect, test } from '~/tests/components/support/test'

type RefreshFailure = {
  readonly notice: string
  readonly committed: OpenDocument
  readonly history: History
  /** The acknowledgement the component's write receives. */
  readonly ack: Acknowledgement
  /** The exact body the component sends for this action. */
  readonly body: unknown
}

/** The acknowledgement the API returns for a committed document. */
function acknowledged(fixture: HistoryCase, committed: OpenDocument): Acknowledgement {
  return historyAcknowledgement(fixture, {
    version: committed.version,
    headRevisionId: committed.headRevisionId,
    liveRevisionId: committed.liveRevisionId,
    liveGeneration: committed.liveGeneration,
  })
}

/** The server state, notice and write of a confirmed action whose refresh then fails. */
function refreshFailure(fixture: HistoryCase, action: 'restore' | 'publish'): RefreshFailure {
  if (action === 'restore') {
    const head = restoredHead(fixture, fixture.first)
    const committed = openDocument(fixture, {
      version: fixture.initial.version + 1,
      headRevisionId: head.revisionId,
      document: fixture.first.document,
    })
    return {
      notice: historyCopy.en.restored,
      committed,
      ack: acknowledged(fixture, committed),
      history: appendedHistory(fixture.history, head),
      body: { expectedVersion: fixture.initial.version, revisionId: fixture.first.revisionId },
    }
  }
  const committed = openDocument(fixture, {
    version: fixture.initial.version + 1,
    liveRevisionId: fixture.latest.revisionId,
    liveGeneration: fixture.initial.liveGeneration + 1,
  })
  return {
    notice: historyCopy.en.published,
    committed,
    ack: acknowledged(fixture, committed),
    history: fixture.history,
    body: {
      expectedVersion: fixture.initial.version,
      revisionId: fixture.latest.revisionId,
      expectedLiveGeneration: fixture.initial.liveGeneration,
    },
  }
}

for (const action of ['restore', 'publish'] as const) {
  test(`history keeps confirmed ${action} success when history refresh fails`, async ({ page }, info) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    const copy = historyCopy.en
    const fixture = historyCase()
    const expected = refreshFailure(fixture, action)
    let documentReads = 0
    let revisionReads = 0
    const api = await serveApi(page, {
      ...historyReads(fixture),
      'GET /api/admin/documents/:id': () => {
        documentReads += 1
        if (action === 'publish' && documentReads === 2) {
          return failure(503, 'UNAVAILABLE')
        }
        return { body: documentReads === 1 ? fixture.initial : expected.committed }
      },
      'GET /api/admin/documents/:id/revisions': () => {
        revisionReads += 1
        if (action === 'restore' && revisionReads === 2) {
          return failure(503, 'UNAVAILABLE')
        }
        return { body: revisionReads === 1 ? fixture.history : expected.history }
      },
      [`POST /api/admin/documents/:id/${action}`]: () => ({ body: expected.ack }),
    })
    try {
      await mountHistory(page)
      if (action === 'restore') {
        await chooseRevision(page, copy, false, 2)
      }
      await confirmAction(page, copy, action)
      await expectRefreshRequired(page, copy, expected.notice)
      if (action === 'restore') {
        await expect(page.locator('.admin-heading')).toContainText(fixture.first.document.meta.title)
      }
      await page.getByRole('alert').scrollIntoViewIfNeeded()
      await page.screenshot({ path: info.outputPath(`history-${action}-refresh-failed.png`) })
      await expectRefreshRecovers(page, copy)
      // The refresh reflects the commit; it never writes a second time.
      const writes = api.calls.filter(call => call.method === 'POST')
      expect(writes.map(call => call.path)).toEqual([
        `${fixture.path}/${action}`,
      ])
      expect(writes[0]?.json).toEqual(expected.body)
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}

test('history retries an uncommitted disconnected operation with the same idempotency key', async ({ page }) => {
  const copy = historyCopy.en
  const fixture = historyCase()
  const restored = restoredHead(fixture, fixture.first)
  let committed: OpenDocument | null = null
  let writes = 0
  const api = await serveApi(page, {
    ...historyReads(fixture),
    'GET /api/admin/documents/:id': () => ({ body: committed ?? fixture.initial }),
    'GET /api/admin/documents/:id/revisions': () => ({
      body: committed === null ? fixture.history : appendedHistory(fixture.history, restored),
    }),
    'POST /api/admin/documents/:id/restore': () => {
      writes++
      if (writes === 1) {
        return lostResponse()
      }
      committed = openDocument(fixture, {
        version: fixture.initial.version + 1,
        headRevisionId: restored.revisionId,
        document: fixture.first.document,
      })
      return {
        body: historyAcknowledgement(fixture, {
          version: committed.version,
          headRevisionId: restored.revisionId,
        }),
      }
    },
  })
  try {
    await mountHistory(page)
    await chooseRevision(page, copy, false, 2)
    await confirmAction(page, copy, 'restore')
    const alert = page.getByRole('alert')
    await expect(alert).toContainText(copy.outcomeUnknown)
    await page.getByRole('button', { name: copy.refresh, exact: true }).click()
    await expect(alert).toHaveCount(0)
    // The retry repeats the original request instead of starting a second write.
    await confirmAction(page, copy, 'restore')
    await expect(page.getByRole('status').filter({ hasText: copy.restored })).toBeVisible()
    expectRetriedWrite(api, {
      route: 'POST /api/admin/documents/:id/restore',
      path: `${fixture.path}/restore`,
      body: { expectedVersion: fixture.initial.version, revisionId: fixture.first.revisionId },
    })
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

test('history explains a definite maintenance rejection without calling it an unknown result', async ({ page }) => {
  const copy = historyCopy.en
  const fixture = historyCase()
  const api = await serveApi(page, {
    ...historyReads(fixture),
    'POST /api/admin/documents/:id/publish': () => failure(503, 'MAINTENANCE'),
  })
  try {
    await mountHistory(page)
    await confirmAction(page, copy, 'publish')
    const alert = page.getByRole('alert')
    await expect(alert).toContainText(copy.maintenance)
    await expect(alert).not.toContainText(copy.unconfirmed)
    await expect(page.getByRole('button', { name: copy.publish, exact: true })).toBeEnabled()
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

test('history keeps a conflict readable when loading the new baseline fails', async ({ page }) => {
  const copy = historyCopy.en
  const fixture = historyCase()
  const external = savedElsewhere(fixture, 'External conflict during history refresh')
  let documentReads = 0
  let revisionReads = 0
  const api = await serveApi(page, {
    ...historyReads(fixture),
    // Bootstrap reads the stale state; the conflict refresh then cannot read the document.
    'GET /api/admin/documents/:id': () => {
      documentReads += 1
      if (documentReads === 2) {
        return failure(503, 'UNAVAILABLE')
      }
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
    await chooseRevision(page, copy, false, 2)
    await confirmAction(page, copy, 'restore')
    await expect(page.getByRole('status').filter({ hasText: copy.conflict })).toBeVisible()
    await expect(page.getByRole('alert')).toContainText(copy.refreshRequired)
    await expect(page.getByRole('button', { name: copy.restore, exact: true })).toBeDisabled()
    await page.getByRole('button', { name: copy.refresh, exact: true }).click()
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(page.getByRole('combobox', { name: copy.compare, exact: true }))
      .toContainText(`${copy.revision} ${external.revision.sequence}`)
    await expect(page.getByRole('button', { name: copy.restore, exact: true })).toBeEnabled()
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

test('a new failed history operation clears the previous success notice', async ({ page }) => {
  const copy = historyCopy.en
  const fixture = historyCase()
  const restored = restoredHead(fixture, fixture.first)
  const committed = openDocument(fixture, {
    version: fixture.initial.version + 1,
    headRevisionId: restored.revisionId,
    document: fixture.first.document,
  })
  let restores = 0
  const api = await serveApi(page, {
    ...historyReads(fixture),
    'GET /api/admin/documents/:id': () => ({ body: restores === 0 ? fixture.initial : committed }),
    'GET /api/admin/documents/:id/revisions': () => ({
      body: restores === 0 ? fixture.history : appendedHistory(fixture.history, restored),
    }),
    'POST /api/admin/documents/:id/restore': () => {
      restores += 1
      if (restores === 1) {
        return {
          body: historyAcknowledgement(fixture, {
            version: committed.version,
            headRevisionId: committed.headRevisionId,
          }),
        }
      }
      return failure(403, 'OWNER_REQUIRED')
    },
  })
  try {
    await mountHistory(page)
    await chooseRevision(page, copy, false, 2)
    await confirmAction(page, copy, 'restore')
    const success = page.getByRole('status').filter({ hasText: copy.restored })
    await expect(success).toBeVisible()
    await confirmAction(page, copy, 'restore')
    await expect(page.getByRole('alert')).toContainText(copy.ownerRequired)
    await expect(success).toHaveCount(0)
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

test('history displays actionable reasons returned by the publication API', async ({ page }) => {
  const copy = historyCopy.en
  const fixture = historyCase()
  const api = await serveApi(page, {
    ...historyReads(fixture),
    'POST /api/admin/documents/:id/publish': () => ({
      status: 422,
      body: { code: 'PUBLICATION_INVALID', issues: ['image', 'table'] },
    }),
  })
  try {
    await mountHistory(page)
    await confirmAction(page, copy, 'publish')
    const alert = page.getByRole('alert')
    await expect(alert.getByRole('listitem')).toHaveText(copy.publicationIssues)
    await expect(alert).not.toContainText('PUBLICATION_INVALID')
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})
