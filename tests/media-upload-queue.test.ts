import type { MediaAsset, MediaRole } from '../src/features/media/media-types'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { inferMediaRole } from '../src/features/media/media-types'
import { hasPendingUploads, MediaUploadQueue } from '../src/features/media/upload-queue'
import { deepEqual } from './assertions'

function asset(file: File, role: MediaRole): MediaAsset {
  const id = crypto.randomUUID()
  return {
    assetId: id,
    state: 'ready',
    url: `/assets/${id}`,
    filename: file.name,
    bytes: file.size,
    type: file.type,
    sha256: 'a'.repeat(64),
    role,
  }
}

test('sequential uploads reject duplicate starts, continue after failures and retry the original file', async () => {
  const first = new File(['image'], 'first.png', { type: 'image/png', lastModified: 1 })
  const second = new File(['text'], 'second.txt', { type: 'text/plain', lastModified: 2 })
  const calls: File[] = []
  const ready: MediaAsset[] = []
  let release: (() => void) | undefined
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  let attempts = 0
  const queue = new MediaUploadQueue(async (file, role) => {
    calls.push(file)
    if (file === first && ++attempts === 1) {
      await held
      throw new Error('Offline')
    }
    return asset(file, role)
  }, value => ready.push(value))
  queue.enqueue([first, second], 'auto')
  assert.equal(hasPendingUploads(queue.snapshot()), true)
  const secondId = queue.snapshot().items[1]?.id ?? ''
  const upload = queue.start()
  assert.equal(queue.snapshot().running, true)
  deepEqual(calls, [first])
  await queue.start()
  queue.remove(secondId)
  queue.enqueue([
    new File(['extra'], 'extra.txt', { type: 'text/plain' }),
  ], 'auto')
  assert.equal(queue.snapshot().items.length, 2)
  release?.()
  await upload
  deepEqual(calls, [first, second])
  assert.deepEqual(queue.snapshot().items.map(item => item.state), ['failed', 'complete'])
  assert.equal(queue.snapshot().running, false)
  assert.equal(hasPendingUploads(queue.snapshot()), true)
  assert.equal(ready.length, 1)
  await queue.start(queue.snapshot().items[0]?.id)
  assert.equal(calls[2], first)
  assert.deepEqual(queue.snapshot().items.map(item => item.state), ['complete', 'complete'])
  assert.equal(hasPendingUploads(queue.snapshot()), false)
  assert.deepEqual(ready.map(item => item.role), ['file', 'image'])
}).catch((error: unknown) => { assert.fail(error instanceof Error ? error.message : 'Test failed') })

test('choosing a failed file again requeues it and completed files can be cleared', async () => {
  const file = new File(['image'], 'cover.jpg', { type: 'image/jpeg', lastModified: 1 })
  let fail = true
  const queue = new MediaUploadQueue(async (value, role) => fail
    ? await Promise.reject(new Error('Retry later'))
    : await Promise.resolve(asset(value, role)), () => {})
  queue.enqueue([file, file], 'poster')
  assert.equal(queue.snapshot().items.length, 1)
  await queue.start()
  assert.equal(queue.snapshot().items[0]?.state, 'failed')
  queue.enqueue([file], 'poster')
  assert.equal(queue.snapshot().items.length, 1)
  assert.equal(queue.snapshot().items[0]?.state, 'queued')
  fail = false
  await queue.start()
  assert.equal(queue.snapshot().items[0]?.role, 'poster')
  queue.clearCompleted()
  assert.deepEqual(queue.snapshot().items, [])
}).catch((error: unknown) => { assert.fail(error instanceof Error ? error.message : 'Test failed') })

test('automatic roles distinguish images, video, audio, captions and documents', () => {
  assert.equal(inferMediaRole({ name: 'image.png', type: 'image/png' }), 'image')
  assert.equal(inferMediaRole({ name: 'clip.mp4', type: 'video/mp4' }), 'video')
  assert.equal(inferMediaRole({ name: 'sound.wav', type: 'audio/wav' }), 'audio')
  assert.equal(inferMediaRole({ name: 'captions.vtt', type: '' }), 'caption')
  assert.equal(inferMediaRole({ name: 'document.pdf', type: 'application/pdf' }), 'file')
}).catch((error: unknown) => { assert.fail(error instanceof Error ? error.message : 'Test failed') })
