import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MediaDestinations } from '@/features/editor/media/media-destinations'
import { deepEqual } from '~/tests/support/unit/assertions'

function file(): File {
  return new File(['image'], `${crypto.randomUUID()}.png`, { type: 'image/png' })
}

test('consecutive edit batches and library choices replace the current media block', () => {
  const target = new MediaDestinations()
  target.prepare('original', 'original', true)
  for (let batch = 0; batch < 2; batch++) {
    target.beginBatch()
    const upload = file()
    deepEqual(target.destination(upload, 'image'), { anchor: 'original', replace: 'original' })
    target.accepted(upload, 'image', 'original')
    deepEqual(target.selected(), { anchor: 'original', replace: 'original' })
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('one multi-file edit batch replaces first and appends the rest while add mode always appends', () => {
  const target = new MediaDestinations()
  const first = file()
  const second = file()
  target.prepare('original', 'original', true)
  target.beginBatch()
  target.destination(first, 'image')
  target.accepted(first, 'image', 'original')
  deepEqual(target.destination(second, 'image'), { anchor: 'original', replace: undefined })
  target.accepted(second, 'image', 'appended')
  target.beginBatch()
  deepEqual(target.destination(file(), 'image'), { anchor: 'appended', replace: 'appended' })
  target.prepare('paragraph', undefined, true)
  target.beginBatch()
  deepEqual(target.destination(first, 'image'), { anchor: 'paragraph', replace: undefined })
  target.accepted(first, 'image', 'new-image')
  target.beginBatch()
  deepEqual(target.destination(second, 'image'), { anchor: 'new-image', replace: undefined })
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('retrying a failed file keeps its original insertion instead of becoming a replacement in a later batch', () => {
  const target = new MediaDestinations()
  const first = file()
  const failed = file()
  target.prepare('original', 'original', true)
  target.beginBatch()
  target.destination(first, 'image')
  target.accepted(first, 'image', 'original')
  const pending = target.destination(failed, 'image')
  target.beginBatch()
  deepEqual(target.destination(file(), 'image'), { anchor: 'original', replace: 'original' })
  deepEqual(target.destination(failed, 'image'), pending)
  deepEqual(pending, { anchor: 'original', replace: undefined })
  target.prepare('different', 'different', true)
  deepEqual(target.destination(failed, 'image'), { anchor: 'different', replace: 'different' })
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('caption and poster uploads do not consume the main media replacement', () => {
  const target = new MediaDestinations()
  const poster = file()
  target.prepare('video', 'video', true)
  target.beginBatch()
  target.destination(poster, 'poster')
  target.accepted(poster, 'poster', 'video')
  deepEqual(target.destination(file(), 'video'), { anchor: 'video', replace: 'video' })
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('retrying an older attachment preserves the current main media target', () => {
  const target = new MediaDestinations()
  const poster = file()
  target.prepare('original', 'original', true)
  target.beginBatch()
  deepEqual(target.destination(poster, 'poster'), { anchor: 'original', replace: 'original' })
  target.accepted(file(), 'video', 'original')
  target.accepted(file(), 'video', 'appended')
  deepEqual(target.destination(poster, 'poster'), { anchor: 'original', replace: 'original' })
  target.accepted(poster, 'poster', 'original')
  deepEqual(target.selected(), { anchor: 'appended', replace: 'appended' })
  target.beginBatch()
  deepEqual(target.destination(file(), 'video'), { anchor: 'appended', replace: 'appended' })
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))
