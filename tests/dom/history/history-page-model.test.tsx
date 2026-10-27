import { act } from 'react'
import { afterEach, expect, it } from 'vitest'
import { openDocumentSchema } from '@/contracts/documents'
import {
  acknowledged,
  failure,
  historyCase,
  historyOf,
  mountHistory,
  page,
  readRevision,
  requestLines,
  resetDomPilot,
  restoredDocument,
  restoredRevision,
  savedElsewhere,
  serveFetch,
  writes,
} from './history-page-support'

/**
 * The history page model in jsdom: the real hook, client and schemas.
 *
 * Only HTTP is stubbed, by replacing `fetch` with a table of explicit replies.
 * The hook, its state and refs, the client's idempotency keys, the Zod schemas
 * and the error classification all run as they do in the browser. Nothing here
 * mounts BlockNote, a router or a Worker.
 */

afterEach(resetDomPilot)

it('treats a maintenance rejection as a definite failure', async () => {
  const fixture = historyCase()
  const stub = serveFetch({
    [`POST ${fixture.path}/publish`]: () => failure(503, 'MAINTENANCE'),
  })
  const view = mountHistory(page(fixture))
  await act(async () => {
    await view.model().perform('publish')
  })
  const model = view.model()
  expect(model.error).toBe('MAINTENANCE')
  expect(model.refreshRequired).toBe(false)
  expect(model.notice).toBeNull()
  expect(model.busy).toBe(false)
  // A definite rejection needs no new baseline: no read follows the write.
  expect(requestLines(stub)).toEqual([
    `POST ${fixture.path}/publish`,
  ])
})

it('keeps an unavailable write unknown and refuses a second write', async () => {
  const fixture = historyCase()
  const stub = serveFetch({
    [`POST ${fixture.path}/restore`]: () => failure(503, 'UNAVAILABLE'),
  })
  const view = mountHistory(page(fixture))
  await act(async () => {
    await view.model().perform('restore')
  })
  const model = view.model()
  expect(model.error).toBe('HISTORY_OUTCOME_UNKNOWN')
  expect(model.refreshRequired).toBe(true)
  expect(model.notice).toBeNull()
  // No acknowledgement was accepted, so the version the page holds is unchanged.
  expect(model.current.version).toBe(fixture.initial.version)
  await act(async () => {
    await view.model().perform('restore')
  })
  expect(writes(stub)).toHaveLength(1)
})

it('keeps a lost response unknown and reuses the idempotency key for the retry', async () => {
  const fixture = historyCase()
  // The revision the case restores, and the head a committed restore would record.
  const restored = restoredRevision(fixture)
  const committed = restoredDocument(fixture, restored)
  const acceptedHistory = historyOf([
    restored,
    ...fixture.stored,
  ])
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
    [`GET ${fixture.path}/revisions`]: () => ({ body: accepted ? acceptedHistory : fixture.history }),
  })
  const view = mountHistory(page(fixture))
  // Select the revision first: a restore writes the revision the page chose, so the
  // reply this case's server sends has to describe that same revision's document.
  await act(async () => {
    await view.model().choose(fixture.first.revisionId, 'selected')
  })
  await act(async () => {
    await view.model().perform('restore')
  })
  expect(view.model().error).toBe('HISTORY_OUTCOME_UNKNOWN')
  expect(view.model().refreshRequired).toBe(true)
  await act(async () => {
    await view.model().refresh()
  })
  expect(view.model().refreshRequired).toBe(false)
  await act(async () => {
    await view.model().perform('restore')
  })
  const model = view.model()
  expect(model.notice).toBe('restored')
  expect(writes(stub)).toHaveLength(2)
  const [first, retry] = writes(stub)
  const body = {
    expectedVersion: fixture.initial.version,
    revisionId: fixture.first.revisionId,
  }
  // The retry repeats the original write instead of starting a second one.
  expect(first?.path).toBe(`${fixture.path}/restore`)
  expect(retry?.path).toBe(first?.path)
  expect(first?.body).toEqual(body)
  expect(retry?.body).toEqual(first?.body)
  expect(first?.headers['idempotency-key']).toMatch(/^[\da-f-]{36}$/)
  expect(retry?.headers['idempotency-key']).toBe(first?.headers['idempotency-key'])
})

it('refreshes the server state on a CAS conflict and keeps the chosen revision', async () => {
  const fixture = historyCase()
  const external = savedElsewhere(fixture, 'Another tab changed the draft')
  const stub = serveFetch({
    [`GET ${fixture.path}/revisions/${fixture.first.revisionId}`]: () => readRevision(fixture.first),
    [`POST ${fixture.path}/restore`]: () => failure(409, 'EDIT_CONFLICT'),
    [`GET ${fixture.path}`]: () => ({ body: external.initial }),
    [`GET ${fixture.path}/revisions`]: () => ({ body: external.history }),
  })
  const view = mountHistory(page(fixture))
  await act(async () => {
    await view.model().choose(fixture.first.revisionId, 'selected')
  })
  await act(async () => {
    await view.model().perform('restore')
  })
  const model = view.model()
  expect(model.notice).toBe('conflict')
  expect(model.error).toBe('')
  // The successful refresh clears the lock: the retry can be started again.
  expect(model.refreshRequired).toBe(false)
  // The conflict is answered by reading, never by repeating the refused write.
  expect(writes(stub)).toHaveLength(1)
  expect(writes(stub)[0]?.body).toEqual({
    expectedVersion: fixture.initial.version,
    revisionId: fixture.first.revisionId,
  })
  // The refresh adopts the new server head but leaves the chosen revision in place.
  expect(model.current.version).toBe(external.initial.version)
  expect(model.current.headRevisionId).toBe(external.revision.revisionId)
  expect(model.current.document.meta.title).toBe('Another tab changed the draft')
  expect(model.baseline.revisionId).toBe(external.revision.revisionId)
  expect(model.selected.revisionId).toBe(fixture.first.revisionId)
})

it('publishes with the version, revision and live generation the page saw', async () => {
  const fixture = historyCase()
  const committed = openDocumentSchema.parse({
    ...fixture.initial,
    version: fixture.initial.version + 1,
    liveRevisionId: fixture.latest.revisionId,
    liveGeneration: fixture.initial.liveGeneration + 1,
    livePath: '/posts/history-latest',
  })
  const stub = serveFetch({
    [`POST ${fixture.path}/publish`]: () => ({
      body: acknowledged(fixture, {
        version: committed.version,
        liveRevisionId: committed.liveRevisionId,
        liveGeneration: committed.liveGeneration,
      }),
    }),
    [`GET ${fixture.path}`]: () => ({ body: committed }),
    [`GET ${fixture.path}/revisions`]: () => ({ body: fixture.history }),
  })
  const view = mountHistory(page(fixture))
  await act(async () => {
    await view.model().perform('publish')
  })
  expect(writes(stub)[0]?.body).toEqual({
    expectedVersion: fixture.initial.version,
    revisionId: fixture.latest.revisionId,
    expectedLiveGeneration: fixture.initial.liveGeneration,
  })
  const model = view.model()
  expect(model.notice).toBe('published')
  expect(model.error).toBe('')
  expect(model.refreshRequired).toBe(false)
  expect(model.current.liveGeneration).toBe(committed.liveGeneration)
  expect(model.current.liveRevisionId).toBe(committed.liveRevisionId)
  expect(model.current.livePath).toBe('/posts/history-latest')
  expect(model.baseline.revisionId).toBe(committed.headRevisionId)
})

it('keeps a confirmed restore visible when the following refresh fails', async () => {
  const fixture = historyCase()
  const restored = restoredRevision(fixture)
  const committed = restoredDocument(fixture, restored)
  let documentReads = 0
  const stub = serveFetch({
    [`GET ${fixture.path}/revisions/${fixture.first.revisionId}`]: () => readRevision(fixture.first),
    [`POST ${fixture.path}/restore`]: () => ({
      body: acknowledged(fixture, {
        version: committed.version,
        headRevisionId: restored.revisionId,
      }),
    }),
    [`GET ${fixture.path}`]: () => {
      documentReads += 1
      return documentReads === 1 ? failure(503, 'UNAVAILABLE') : { body: committed }
    },
    [`GET ${fixture.path}/revisions`]: () => ({
      body: historyOf([
        restored,
        ...fixture.stored,
      ]),
    }),
  })
  const view = mountHistory(page(fixture))
  await act(async () => {
    await view.model().choose(fixture.first.revisionId, 'selected')
  })
  await act(async () => {
    await view.model().perform('restore')
  })
  const model = view.model()
  // The confirmed result stays visible; only the missing refresh is reported.
  expect(model.notice).toBe('restored')
  expect(model.error).toBe('HISTORY_REFRESH_REQUIRED')
  expect(model.refreshRequired).toBe(true)
  expect(model.current.version).toBe(committed.version)
  expect(model.current.headRevisionId).toBe(restored.revisionId)
  expect(model.baseline.revisionId).toBe(restored.revisionId)
  expect(model.selected.revisionId).toBe(fixture.first.revisionId)
  expect(writes(stub)).toHaveLength(1)
})
