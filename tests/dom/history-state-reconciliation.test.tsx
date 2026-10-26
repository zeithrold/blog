import type { StoredRevision } from './history-page-support'
import type { OpenDocument } from '@/contracts/documents'
import { afterEach, expect, it } from 'vitest'
import { historyCopy } from '~/tests/components/support/history-copy'
import {
  historyCase,
  historyOf,
  page,
  readRevision,
  restoredOn,
  serveFetch,
  writes,
} from './history-page-support'
import { click, renderPage, resetDomPage, visibleText } from './history-state-support'

/**
 * The page's reconciliation loop, rendered in jsdom.
 *
 * Nine restores commit on the server and lose their answer on the way back. The
 * page must say so, lock the next write, and only unlock it by reading the state
 * the server now holds. Each refresh advances the held version, so each round
 * writes with a fresh client and its own idempotency key: the pending-key budget
 * of a single client never runs out. What the server did with those nine writes
 * is proved against real D1 in the integration layer.
 */

const copy = historyCopy.en

const missingKey = /^$/
const anyKey = /^[\da-f-]{36}$/

afterEach(resetDomPage)

it('reconciles nine unconfirmed restores and writes each round with its own key', async () => {
  const fixture = historyCase()
  let served: OpenDocument = fixture.initial
  let stored: StoredRevision[] = [
    ...fixture.stored,
  ]
  const keys: string[] = []
  const stub = serveFetch({
    [`GET ${fixture.path}/revisions/${fixture.first.revisionId}`]: () => readRevision(fixture.first),
    [`POST ${fixture.path}/restore`]: (call) => {
      keys.push(call.headers['idempotency-key'] ?? '')
      // The server commits the restore, then the answer is lost on the way back.
      const restored: StoredRevision = {
        ...fixture.first,
        revisionId: crypto.randomUUID(),
        sequence: stored.length + 1,
        reason: 'restore',
      }
      served = restoredOn(served, restored)
      stored = [
        restored,
        ...stored,
      ]
      return 'disconnected'
    },
    [`GET ${fixture.path}`]: () => ({ body: served }),
    [`GET ${fixture.path}/revisions`]: () => ({ body: historyOf(stored) }),
  })
  const view = renderPage(page(fixture))
  await click(view.button(new RegExp(`^${copy.revision} ${fixture.first.sequence}\\b`)))
  for (let attempt = 1; attempt <= 9; attempt++) {
    const expectedVersion = served.version
    await click(view.button(copy.restore))
    await click(view.button(copy.confirm))
    expect(visibleText(view.alert())).toBe(copy.outcomeUnknown)
    expect(view.button(copy.restore).disabled).toBe(true)
    expect(view.statuses()).not.toContain(copy.restored)
    const sent = writes(stub)
    expect(sent).toHaveLength(attempt)
    expect(sent[attempt - 1]?.body).toEqual({
      expectedVersion,
      revisionId: fixture.first.revisionId,
    })
    // Reading the stored state clears the lock and adopts the committed head.
    await click(view.button(copy.refresh))
    expect(view.alert()).toBeNull()
    expect(visibleText(view.combobox(copy.compare))).toContain(`${copy.revision} ${3 + attempt}`)
  }
  expect(keys).toHaveLength(9)
  expect(keys.filter(key => missingKey.test(key))).toEqual([])
  expect(new Set(keys).size).toBe(9)
  for (const key of keys) {
    expect(key).toMatch(anyKey)
  }
})
