import type { Acknowledgement, OpenDocument } from '../src/features/editor/services/api-client'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { emptyDocument, validateDocument } from '../src/content/document'
import { keepLocalRevision } from '../src/features/editor/core/conflict-resolution'
import { DraftCoordinator } from '../src/features/editor/core/draft'
import { APIError } from '../src/features/editor/services/api-client'
import { equal } from './assertions'

function initial(): OpenDocument {
  return {
    documentId: crypto.randomUUID(),
    version: 1,
    headRevisionId: crypto.randomUUID(),
    liveRevisionId: null,
    liveGeneration: 0,
    kind: 'article',
    livePath: null,
    document: emptyDocument(),
  }
}

test('conflict replacement saves edits arriving after its snapshot against the new server revision', async () => {
  const remote = initial()
  const latest = emptyDocument()
  latest.meta.title = 'Local conflict content'
  let sendCount = 0
  let start: (() => void) | undefined
  const started = new Promise<void>((resolve) => {
    start = resolve
  })
  let finish: ((value: Acknowledgement) => void) | undefined
  const replacement = new Promise<Acknowledgement>((resolve) => {
    finish = resolve
  })
  const resolved = { ...remote, version: 2, headRevisionId: crypto.randomUUID() }
  const coordinator = new DraftCoordinator(
    remote,
    async () => await Promise.resolve(structuredClone(latest)),
    async (packet) => {
      if (sendCount++ === 0) {
        throw new APIError(409, 'EDIT_CONFLICT')
      }
      equal(packet.body.expectedVersion, resolved.version)
      equal(packet.body.baseRevisionId, resolved.headRevisionId)
      equal(packet.body.document.meta.title, 'Later local input')
      return await Promise.resolve({ ...resolved, version: 3, headRevisionId: crypto.randomUUID() })
    },
    () => {},
  )
  try {
    coordinator.change()
    equal(await coordinator.flush(), false)
    const saving = keepLocalRevision({
      snapshot: async () => await Promise.resolve(structuredClone(latest)),
      client: {
        write: async (_path, _method, body) => {
          assert.ok(body !== null && typeof body === 'object')
          const submitted: unknown = Reflect.get(body, 'document')
          equal(validateDocument(submitted).meta.title, 'Local conflict content')
          start?.()
          return await replacement
        },
      },
      coordinator,
    }, remote)
    await started
    latest.meta.title = 'Later local input'
    coordinator.change()
    assert.ok(finish !== undefined)
    finish(resolved)
    await saving
    equal(coordinator.dirty, true)
    equal(await coordinator.flush(), true)
    equal(sendCount, 2)
  }
  finally {
    coordinator.dispose()
  }
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})

test('a failed explicit replacement keeps the conflicted coordinator blocked', async () => {
  const remote = initial()
  let sends = 0
  const coordinator = new DraftCoordinator(
    remote,
    async () => await Promise.resolve(remote.document),
    async () => {
      sends++
      return await Promise.reject(new APIError(409, 'EDIT_CONFLICT'))
    },
    () => {},
  )
  try {
    coordinator.change()
    await coordinator.flush()
    await assert.rejects(keepLocalRevision({
      snapshot: async () => await Promise.resolve(remote.document),
      client: { write: async () => await Promise.reject(new APIError(409, 'EDIT_CONFLICT')) },
      coordinator,
    }, remote), /EDIT_CONFLICT/)
    equal(await coordinator.flush(), false)
    equal(sends, 1)
    equal(coordinator.acknowledgement.headRevisionId, remote.headRevisionId)
  }
  finally {
    coordinator.dispose()
  }
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})
