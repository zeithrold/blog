import type { Acknowledgement } from '@/server/repository'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { emptyDocument } from '@/content/document'
import { DraftCoordinator } from '@/features/editor/core/draft'
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

test('a late save response cannot hide an action conflict or resume saving without resolution', async () => {
  const ack = initial()
  const states: string[] = []
  let finish: ((value: Acknowledgement) => void) | undefined
  let sends = 0
  const coordinator = new DraftCoordinator(
    ack,
    async () => await Promise.resolve(emptyDocument()),
    async () => {
      sends++
      if (sends > 1) {
        return { ...ack, version: 3 }
      }
      return await new Promise((resolve) => {
        finish = resolve
      })
    },
    state => states.push(state),
  )
  try {
    coordinator.change()
    const saving = coordinator.flush()
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
    coordinator.conflict()
    assert.ok(finish !== undefined)
    finish({ ...ack, version: 1 })
    equal(await saving, false)
    equal(states.at(-1), 'conflict')
    equal(coordinator.acknowledgement.version, 0)
    coordinator.change()
    equal(await coordinator.settle(), false)
    equal(sends, 1)
    coordinator.accept({ ...ack, version: 2 })
    equal(states.at(-1), 'conflict')
    coordinator.resumeAfterCorrection()
    equal(await coordinator.settle(), true)
    equal(states.at(-1), 'saved')
    equal(sends, 2)
  }
  finally {
    coordinator.dispose()
  }
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})

for (const lateFailure of [false, true]) {
  test(`conflict resolution stays current after an older save ${lateFailure ? 'fails' : 'succeeds'}`, async () => {
    const ack = initial()
    const versions: number[] = []
    const states: string[] = []
    let finish: ((value: Acknowledgement) => void) | undefined
    let reject: ((error: Error) => void) | undefined
    const coordinator = new DraftCoordinator(
      ack,
      async () => await Promise.resolve(emptyDocument()),
      async (packet) => {
        versions.push(packet.body.expectedVersion)
        if (versions.length > 1) {
          return { ...ack, version: 4 }
        }
        return await new Promise((resolve, fail) => {
          finish = resolve
          reject = fail
        })
      },
      state => states.push(state),
    )
    try {
      coordinator.change()
      const saving = coordinator.flush()
      await new Promise((resolve) => {
        setTimeout(resolve, 0)
      })
      coordinator.conflict()
      coordinator.accept({ ...ack, version: 3 })
      coordinator.resumeAfterCorrection()
      assert.ok(finish !== undefined && reject !== undefined)
      if (lateFailure) {
        reject(Object.assign(new Error('EDIT_CONFLICT'), { status: 409 }))
      }
      else {
        finish({ ...ack, version: 2 })
      }
      equal(await saving, false)
      equal(coordinator.acknowledgement.version, 3)
      equal(states.at(-1), 'dirty')
      equal(await coordinator.settle(), true)
      deepEqual(versions, [0, 3])
      equal(states.at(-1), 'saved')
    }
    finally {
      coordinator.dispose()
    }
  }).catch((error: unknown) => {
    assert.fail(error instanceof Error ? error.message : 'Test failed')
  })
}

test('settlement waiting on an invalidated request drains the corrected draft', async () => {
  const ack = initial()
  const versions: number[] = []
  let finish: ((value: Acknowledgement) => void) | undefined
  const coordinator = new DraftCoordinator(
    ack,
    async () => await Promise.resolve(emptyDocument()),
    async (packet) => {
      versions.push(packet.body.expectedVersion)
      if (versions.length > 1) {
        return { ...ack, version: 4 }
      }
      return await new Promise((resolve) => {
        finish = resolve
      })
    },
    () => {},
  )
  try {
    coordinator.change()
    const saving = coordinator.flush()
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
    coordinator.conflict()
    coordinator.accept({ ...ack, version: 3 })
    coordinator.resumeAfterCorrection()
    const settling = coordinator.settle()
    assert.ok(finish !== undefined)
    finish({ ...ack, version: 2 })
    equal(await saving, false)
    equal(await settling, true)
    deepEqual(versions, [0, 3])
    equal(coordinator.dirty, false)
    equal(coordinator.acknowledgement.version, 4)
  }
  finally {
    coordinator.dispose()
  }
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})
