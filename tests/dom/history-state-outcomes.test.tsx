import type { HistoryCopy } from '~/tests/components/support/history-copy'
import { afterEach, expect, it } from 'vitest'
import { openDocumentSchema } from '@/contracts/documents'
import { historyCopy } from '~/tests/components/support/history-copy'
import {
  acknowledged,
  failure,
  historyCase,
  historyOf,
  page,
  readRevision,
  requestLines,
  restoredOn,
  restoredRevision,
  serveFetch,
  writes,
} from './history-page-support'
import {
  click,
  headerTitle,
  renderPage,
  resetDomPage,
  revisionRows,
  selectedRevision,
  visibleText,
} from './history-state-support'

/**
 * What the history page reports, refuses and writes, rendered in jsdom.
 *
 * Every case mounts the unmodified `HistoryPage` and answers its HTTP traffic
 * from its own table: the hook, the client's idempotency keys, the Zod schemas
 * and the error classification all run for real. The cases below replace the
 * component browser cases that only read text and control state from the page;
 * geometry, native focus and the real Worker stay where they are.
 */

const copy = historyCopy.en

const key = /^[\da-f-]{36}$/

/** The revision the sidebar selects, by the sequence the reader sees. */
function revisionRow(labels: HistoryCopy, sequence: number): RegExp {
  return new RegExp(`^${labels.revision} ${sequence}\\b`)
}

afterEach(resetDomPage)

it('keeps the confirmed restore when the following history read is refused', async () => {
  const fixture = historyCase()
  const restored = restoredRevision(fixture)
  const committed = restoredOn(fixture.initial, restored)
  // The refused read is the revision list the action invalidated, as in the
  // component case: the document read succeeds, the history read does not.
  let revisionReads = 0
  const stub = serveFetch({
    [`GET ${fixture.path}/revisions/${fixture.first.revisionId}`]: () => readRevision(fixture.first),
    [`POST ${fixture.path}/restore`]: () => ({
      body: acknowledged(fixture, { version: committed.version, headRevisionId: restored.revisionId }),
    }),
    [`GET ${fixture.path}`]: () => ({ body: committed }),
    [`GET ${fixture.path}/revisions`]: () => {
      revisionReads += 1
      if (revisionReads === 1) {
        return failure(503, 'UNAVAILABLE')
      }
      return { body: historyOf([
        restored,
        ...fixture.stored,
      ]) }
    },
  })
  const view = renderPage(page(fixture))
  // The held head revision is already what the page shows, so it cannot be restored again.
  expect(view.button(copy.restore).disabled).toBe(true)
  await click(view.button(revisionRow(copy, fixture.first.sequence)))
  expect(selectedRevision(view)).toBe(fixture.first.revisionId)
  expect(view.button(copy.restore).disabled).toBe(false)
  await click(view.button(copy.restore))
  // The confirmation names the revision the write would create from.
  expect(visibleText(document.querySelector('[role="dialog"]'))).toContain(fixture.first.document.meta.title)
  await click(view.button(copy.confirm))
  expect(view.statuses()).toContain(copy.restored)
  expect(visibleText(view.alert())).toBe(copy.refreshRequired)
  // The confirmed state stays visible: the page shows the restored revision's title.
  expect(headerTitle(view)).toBe(fixture.first.document.meta.title)
  expect(selectedRevision(view)).toBe(fixture.first.revisionId)
  for (const action of [copy.restore, copy.publish]) {
    expect(view.button(action).disabled).toBe(true)
  }
  expect(view.combobox(copy.compare).disabled).toBe(true)
  await click(view.button(copy.refresh))
  expect(view.alert()).toBeNull()
  expect(view.combobox(copy.compare).disabled).toBe(false)
  expect(revisionRows(view)).toHaveLength(4)
  expect(revisionRows(view)[0]).toMatch(revisionRow(copy, 4))
  // Refreshing is a read: the single write still stands, unchanged.
  expect(writes(stub)).toHaveLength(1)
  expect(writes(stub)[0]?.body).toEqual({
    expectedVersion: fixture.initial.version,
    revisionId: fixture.first.revisionId,
  })
})

it('keeps the confirmed publish and the new live generation when the following read is refused', async () => {
  const fixture = historyCase()
  const committed = openDocumentSchema.parse({
    ...fixture.initial,
    version: fixture.initial.version + 1,
    liveRevisionId: fixture.latest.revisionId,
    liveGeneration: fixture.initial.liveGeneration + 1,
    livePath: '/posts/history-latest',
  })
  let documentReads = 0
  const stub = serveFetch({
    [`POST ${fixture.path}/publish`]: () => ({
      body: acknowledged(fixture, {
        version: committed.version,
        liveRevisionId: committed.liveRevisionId,
        liveGeneration: committed.liveGeneration,
      }),
    }),
    [`GET ${fixture.path}`]: () => {
      documentReads += 1
      return documentReads === 1 ? failure(503, 'UNAVAILABLE') : { body: committed }
    },
    [`GET ${fixture.path}/revisions`]: () => ({ body: fixture.history }),
  })
  const view = renderPage(page(fixture))
  await click(view.button(copy.publish))
  const confirmation = visibleText(document.querySelector('[role="dialog"]'))
  // The confirmation names the URL this revision publishes to, and the live URL
  // that stops working because it is a different document path.
  expect(confirmation).toContain('/posts/history-latest')
  expect(confirmation).toContain('/posts/history-first')
  await click(view.button(copy.confirm))
  expect(view.statuses()).toContain(copy.published)
  expect(visibleText(view.alert())).toBe(copy.refreshRequired)
  expect(headerTitle(view)).toBe(fixture.latest.document.meta.title)
  // The lock is the refresh requirement, not the live revision: compare is refused
  // by the refused read, which a merely-live publish would not do.
  expect(view.combobox(copy.compare).disabled).toBe(true)
  expect(view.button(copy.publish).disabled).toBe(true)
  await click(view.button(copy.refresh))
  expect(view.alert()).toBeNull()
  expect(view.combobox(copy.compare).disabled).toBe(false)
  // The refreshed state now has this revision live, so publishing it again is refused.
  expect(view.button(copy.publish).disabled).toBe(true)
  // Refreshing is a read: the single write still stands, unchanged.
  expect(writes(stub)).toHaveLength(1)
  // A publish carries the live generation the page saw, so a concurrent
  // publication is a conflict rather than a silent overwrite.
  expect(writes(stub)[0]?.body).toEqual({
    expectedVersion: fixture.initial.version,
    revisionId: fixture.latest.revisionId,
    expectedLiveGeneration: fixture.initial.liveGeneration,
  })
})

it('retries a disconnected restore from the page with the same idempotency key', async () => {
  const fixture = historyCase()
  const restored = restoredRevision(fixture)
  const committed = restoredOn(fixture.initial, restored)
  let attempts = 0
  let accepted = false
  const stub = serveFetch({
    [`GET ${fixture.path}/revisions/${fixture.first.revisionId}`]: () => readRevision(fixture.first),
    [`POST ${fixture.path}/restore`]: () => {
      attempts += 1
      if (attempts === 1) {
        return 'disconnected'
      }
      accepted = true
      return {
        body: acknowledged(fixture, { version: committed.version, headRevisionId: restored.revisionId }),
      }
    },
    [`GET ${fixture.path}`]: () => ({ body: accepted ? committed : fixture.initial }),
    [`GET ${fixture.path}/revisions`]: () => ({
      body: accepted
        ? historyOf([
            restored,
            ...fixture.stored,
          ])
        : fixture.history,
    }),
  })
  const view = renderPage(page(fixture))
  await click(view.button(revisionRow(copy, fixture.first.sequence)))
  await click(view.button(copy.restore))
  await click(view.button(copy.confirm))
  expect(visibleText(view.alert())).toBe(copy.outcomeUnknown)
  expect(view.button(copy.restore).disabled).toBe(true)
  expect(view.statuses()).not.toContain(copy.restored)
  await click(view.button(copy.refresh))
  expect(view.alert()).toBeNull()
  await click(view.button(copy.restore))
  await click(view.button(copy.confirm))
  expect(view.statuses()).toContain(copy.restored)
  const attemptsSent = writes(stub)
  expect(attemptsSent).toHaveLength(2)
  const [first, retry] = attemptsSent
  const body = { expectedVersion: fixture.initial.version, revisionId: fixture.first.revisionId }
  // The retry repeats the original request instead of starting a second write.
  expect([first?.path, retry?.path]).toEqual([
    `${fixture.path}/restore`,
    `${fixture.path}/restore`,
  ])
  expect([first?.body, retry?.body]).toEqual([body, body])
  expect(first?.headers['idempotency-key']).toMatch(key)
  expect(retry?.headers['idempotency-key']).toBe(first?.headers['idempotency-key'])
})

it('reports a maintenance refusal as a definite failure that stays retryable', async () => {
  const fixture = historyCase()
  const stub = serveFetch({
    [`POST ${fixture.path}/publish`]: () => failure(503, 'MAINTENANCE'),
  })
  const view = renderPage(page(fixture))
  await click(view.button(copy.publish))
  await click(view.button(copy.confirm))
  const alert = visibleText(view.alert())
  expect(alert).toBe(copy.maintenance)
  expect(alert).not.toContain(copy.unconfirmed)
  // A refused write that certainly did not commit needs no refresh and locks nothing.
  expect(view.button(copy.publish).disabled).toBe(false)
  expect(requestLines(stub)).toEqual([
    `POST ${fixture.path}/publish`,
  ])
})

it('replaces an earlier success notice with the refusal of the next restore', async () => {
  const fixture = historyCase()
  const restored = restoredRevision(fixture)
  const committed = restoredOn(fixture.initial, restored)
  let restores = 0
  const stub = serveFetch({
    [`GET ${fixture.path}/revisions/${fixture.first.revisionId}`]: () => readRevision(fixture.first),
    [`POST ${fixture.path}/restore`]: () => {
      restores += 1
      if (restores === 1) {
        return {
          body: acknowledged(fixture, { version: committed.version, headRevisionId: restored.revisionId }),
        }
      }
      return failure(403, 'OWNER_REQUIRED')
    },
    [`GET ${fixture.path}`]: () => ({ body: restores === 0 ? fixture.initial : committed }),
    [`GET ${fixture.path}/revisions`]: () => ({
      body: restores === 0
        ? fixture.history
        : historyOf([
            restored,
            ...fixture.stored,
          ]),
    }),
  })
  const view = renderPage(page(fixture))
  await click(view.button(revisionRow(copy, fixture.first.sequence)))
  await click(view.button(copy.restore))
  await click(view.button(copy.confirm))
  expect(view.statuses()).toContain(copy.restored)
  await click(view.button(copy.restore))
  await click(view.button(copy.confirm))
  expect(visibleText(view.alert())).toBe(copy.ownerRequired)
  expect(view.statuses()).not.toContain(copy.restored)
  expect(writes(stub)).toHaveLength(2)
})

it('lists the publication reasons the API refused the publish with', async () => {
  const fixture = historyCase()
  const stub = serveFetch({
    [`POST ${fixture.path}/publish`]: () => ({
      status: 422,
      body: { code: 'PUBLICATION_INVALID', issues: ['image', 'table'] },
    }),
  })
  const view = renderPage(page(fixture))
  await click(view.button(copy.publish))
  await click(view.button(copy.confirm))
  const alert = view.alert()
  const reasons = Array.from(alert?.querySelectorAll('li') ?? [], item => visibleText(item))
  expect(reasons).toEqual(copy.publicationIssues)
  expect(visibleText(alert)).not.toContain('PUBLICATION_INVALID')
  expect(writes(stub)).toHaveLength(1)
})
