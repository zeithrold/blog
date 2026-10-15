import type { Acknowledgement } from '../src/server/repository'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { emptyDocument } from '../src/content/document'
import { DraftCoordinator } from '../src/features/editor/core/draft'
import { APIError } from '../src/features/editor/services/api-client'
import { deepEqual, equal } from './assertions'

function initial(): Acknowledgement {
  return {
    documentId: crypto.randomUUID(),
    version: 1,
    headRevisionId: crypto.randomUUID(),
    liveRevisionId: null,
    liveGeneration: 0,
  }
}

test('metadata cancellation preserves a rejected draft and rebases its corrected save', async () => {
  const ack = initial()
  let fail = true
  const versions: number[] = []
  const states: string[] = []
  const coordinator = new DraftCoordinator(ack, async () => await Promise.resolve(emptyDocument()), async (packet) => {
    versions.push(packet.body.expectedVersion)
    if (fail) {
      throw new APIError(422, 'INVALID_DOCUMENT')
    }
    return await Promise.resolve({ ...ack, version: 3 })
  }, (state, _ack, code) => states.push(`${state}:${code ?? ''}`))
  try {
    coordinator.change()
    equal(await coordinator.settle(), false)
    await coordinator.mutateMetadata(async () => await Promise.resolve({ ...ack, version: 2 }))
    equal(coordinator.dirty, true)
    equal(states.at(-1), 'error:INVALID_DOCUMENT')
    fail = false
    coordinator.change()
    equal(await coordinator.settle(), true)
    deepEqual(versions, [1, 2])
  }
  finally {
    coordinator.dispose()
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('metadata cancellation waits for an active save and holds newer edits until it finishes', async () => {
  const ack = initial()
  let finish: (value: Acknowledgement) => void = () => {}
  let sends = 0
  let started = (): void => {}
  const requested = new Promise<void>((resolve) => {
    started = resolve
  })
  const coordinator = new DraftCoordinator(ack, async () => await Promise.resolve(emptyDocument()), async () => {
    sends++
    return await new Promise((resolve) => {
      finish = resolve
      started()
    })
  }, () => {})
  try {
    coordinator.change()
    const saving = coordinator.flush()
    await requested
    let performed = false
    const mutation = coordinator.mutateMetadata(async () => {
      performed = true
      coordinator.change()
      equal(await coordinator.flush(), false)
      return await Promise.resolve({ ...ack, version: 3 })
    })
    equal(performed, false)
    finish({ ...ack, version: 2 })
    await saving
    await mutation
    equal(performed, true)
    equal(sends, 1)
    equal(coordinator.dirty, true)
    equal(coordinator.acknowledgement.version, 3)
  }
  finally {
    coordinator.dispose()
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('metadata cancellation does not adopt another tabs draft or release an existing conflict', async () => {
  const ack = initial()
  const states: string[] = []
  let sends = 0
  const coordinator = new DraftCoordinator(ack, async () => await Promise.resolve(emptyDocument()), async () => {
    sends++
    return await Promise.resolve(ack)
  }, state => states.push(state))
  try {
    coordinator.change()
    coordinator.conflict()
    await coordinator.mutateMetadata(async () => await Promise.resolve({
      ...ack,
      version: 2,
      headRevisionId: crypto.randomUUID(),
    }))
    equal(coordinator.acknowledgement.headRevisionId, ack.headRevisionId)
    equal(await coordinator.settle(), false)
    equal(states.at(-1), 'conflict')
    equal(sends, 0)
    equal(coordinator.dirty, true)
  }
  finally {
    coordinator.dispose()
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))
