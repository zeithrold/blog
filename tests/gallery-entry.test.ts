import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import { gallerySession, openGallery } from '../src/features/media/gallery-session'
import { deepEqual, equal } from './assertions'

function file(): File {
  return new File(['test'], 'test.txt', { type: 'text/plain' })
}

test('browser gallery sessions retain files and live unload protection while views are absent', () => {
  const browser = new EventTarget()
  Object.defineProperty(globalThis, 'window', { value: browser, configurable: true })
  try {
    const first = gallerySession('first-owner', 'token')
    const selected = file()
    first.queue.enqueue([selected], 'file')
    first.setRole('image')
    first.setOpen(true)
    first.subscribe(() => {})()
    equal(gallerySession('first-owner', 'stale-token'), first)
    equal(first.queue.snapshot().items[0]?.file, selected)
    equal(first.snapshot().role, 'image')
    equal(first.snapshot().open, true)
    const warned = new Event('beforeunload', { cancelable: true })
    browser.dispatchEvent(warned)
    equal(warned.defaultPrevented, true)
    const second = gallerySession('second-owner', 'token')
    equal(first.isDisposed(), true)
    equal(first.queue.snapshot().items.length, 0)
    equal(second.queue.snapshot().items.length, 0)
    const clean = new Event('beforeunload', { cancelable: true })
    browser.dispatchEvent(clean)
    equal(clean.defaultPrevented, false)
    second.dispose()
  }
  finally {
    Reflect.deleteProperty(globalThis, 'window')
  }
}).catch((error: unknown) => { throw error })

test('server gallery sessions never retain files across requests', () => {
  const first = gallerySession('owner', 'token')
  first.queue.enqueue([
    file(),
  ], 'file')
  const second = gallerySession('owner', 'token')
  assert.notEqual(first, second)
  equal(second.queue.snapshot().items.length, 0)
  equal(first.serverSnapshot().items.length, 0)
  first.dispose()
  second.dispose()
}).catch((error: unknown) => { throw error })

test('entry verification checks identity before exposing any retained gallery state', async () => {
  const browser = new EventTarget()
  Object.defineProperty(globalThis, 'window', { value: browser, configurable: true })
  const paths: string[] = []
  const fetch = mock.method(globalThis, 'fetch', async (path: unknown) => {
    paths.push((typeof path === 'string' ? path : 'Unexpected request'))
    return await Promise.resolve(Response.json({ ownerSub: 'other-owner', csrfToken: 'other-token' }))
  })
  try {
    const previous = gallerySession('expected-owner', 'token')
    previous.queue.enqueue([
      file(),
    ], 'file')
    await assert.rejects(openGallery('expected-owner', new AbortController().signal), { message: 'AUTH_INVALID' })
    equal(previous.isDisposed(), true)
    equal(previous.queue.snapshot().items.length, 0)
    deepEqual(paths, ['/api/admin/session'])
  }
  finally {
    fetch.mock.restore()
    Reflect.deleteProperty(globalThis, 'window')
  }
}).catch((error: unknown) => { throw error })

test('a stale entry rejects its old owner without disposing the current owner queue', async () => {
  const browser = new EventTarget()
  Object.defineProperty(globalThis, 'window', { value: browser, configurable: true })
  const fetch = mock.method(globalThis, 'fetch', async () => await Promise.resolve(Response.json({
    ownerSub: 'current-owner',
    csrfToken: 'current-token',
  })))
  try {
    const current = gallerySession('current-owner', 'current-token')
    const selected = file()
    current.queue.enqueue([selected], 'file')
    await assert.rejects(openGallery('old-owner', new AbortController().signal), { message: 'AUTH_INVALID' })
    equal(current.isDisposed(), false)
    equal(current.queue.snapshot().items[0]?.file, selected)
    equal(await openGallery('current-owner', new AbortController().signal), current)
    current.dispose()
  }
  finally {
    fetch.mock.restore()
    Reflect.deleteProperty(globalThis, 'window')
  }
}).catch((error: unknown) => { throw error })
