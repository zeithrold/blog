import type { Acknowledgement } from '@/contracts/documents'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { emptyDocument } from '@/content/document'
import { DraftCoordinator } from '@/features/editor/draft/draft'
import { deepEqual, equal } from '~/tests/support/unit/assertions'

function initial(): Acknowledgement {
  return {
    documentId: crypto.randomUUID(),
    version: 0,
    headRevisionId: crypto.randomUUID(),
    liveRevisionId: null,
    liveGeneration: 0,
  }
}

test('save has at most one inflight packet and never acknowledges edits made after snapshot', async () => {
  let finish: ((value: Acknowledgement) => void) | undefined
  let count = 0
  const first = initial()
  const coordinator = new DraftCoordinator(
    first,
    async () => await Promise.resolve(emptyDocument()),
    async () => {
      count++
      return await new Promise((resolve) => {
        finish = resolve
      })
    },
    () => {},
  )
  try {
    coordinator.change()
    const request = coordinator.flush()
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
    coordinator.change()
    equal(count, 1)
    assert.ok(finish !== undefined)
    finish({ ...first, version: 1, headRevisionId: crypto.randomUUID() })
    equal(await request, false)
    equal(coordinator.dirty, true)
    equal(coordinator.acknowledgement.version, 1)
  }
  finally {
    coordinator.dispose()
  }
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})

test('unknown response retries the exact idempotency packet and 409 preserves dirty state', async () => {
  const keys: string[] = []
  const bodies: string[] = []
  const coordinator = new DraftCoordinator(
    initial(),
    async () => await Promise.resolve(emptyDocument()),
    async (packet) => {
      keys.push(packet.key)
      bodies.push(JSON.stringify(packet.body))
      return await Promise.reject(
        keys.length === 1
          ? new Error('network')
          : Object.assign(new Error('EDIT_CONFLICT'), { status: 409 }),
      )
    },
    () => {},
  )
  try {
    coordinator.change()
    await coordinator.flush()
    await coordinator.flush()
    equal(keys.length, 2)
    equal(keys[0], keys[1])
    equal(bodies[0], bodies[1])
    equal(coordinator.dirty, true)
    await coordinator.flush()
    equal(keys.length, 2)
  }
  finally {
    coordinator.dispose()
  }
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})

test('composition defers persistence', async () => {
  let reads = 0
  const coordinator = new DraftCoordinator(
    initial(),
    async () => {
      reads++
      return await Promise.resolve(emptyDocument())
    },
    async packet =>
      await Promise.resolve({
        ...initial(),
        headRevisionId: packet.body.baseRevisionId,
      }),
    () => {},
  )
  try {
    coordinator.composing = true
    coordinator.change()
    await coordinator.flush()
    equal(reads, 0)
  }
  finally {
    coordinator.dispose()
  }
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})

test('publish settlement drains an edit arriving during the first save', async () => {
  const ack = initial()
  const versions: number[] = []
  const coordinator = new DraftCoordinator(
    ack,
    async () => await Promise.resolve(emptyDocument()),
    async (packet) => {
      versions.push(packet.body.expectedVersion)
      if (versions.length === 1) {
        coordinator.change()
      }
      return await Promise.resolve({ ...ack, version: packet.body.expectedVersion + 1 })
    },
    () => {},
  )
  try {
    coordinator.change()
    equal(await coordinator.settle(), true)
    equal(coordinator.dirty, false)
    deepEqual(versions, [0, 1])
  }
  finally {
    coordinator.dispose()
  }
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})

test('oversized snapshot stops retries and resumes after the user corrects content', async () => {
  const ack = initial()
  let oversized = true
  let sends = 0
  const states: string[] = []
  const coordinator = new DraftCoordinator(
    ack,
    async () => {
      if (oversized) {
        throw Object.assign(new Error('DOCUMENT_TOO_LARGE'), { status: 413 })
      }
      return await Promise.resolve(emptyDocument())
    },
    async () => {
      sends++
      return await Promise.resolve({ ...ack, version: 1 })
    },
    state => states.push(state),
  )
  try {
    coordinator.change()
    equal(await coordinator.settle(), false)
    equal(states.at(-1), 'error')
    equal(sends, 0)
    oversized = false
    coordinator.change()
    equal(await coordinator.settle(), true)
    equal(sends, 1)
  }
  finally {
    coordinator.dispose()
  }
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})
