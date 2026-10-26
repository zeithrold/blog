import { expect, it } from 'vitest'
import { serveFetch } from '~/tests/dom/http'

it('restores native fetch after disposing nested tables in LIFO order', async () => {
  const nativeFetch = globalThis.fetch
  const first = serveFetch({
    'GET /api/admin/dispose-order': () => ({ body: { source: 'first' } }),
  })
  const second = serveFetch({
    'GET /api/admin/dispose-order': () => ({ body: { source: 'second' } }),
  })

  second.dispose()
  first.dispose()

  expect(globalThis.fetch).toBe(nativeFetch)
  await expect(fetch('/api/admin/dispose-order')).rejects.toThrow()
})
