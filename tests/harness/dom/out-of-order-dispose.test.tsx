import { expect, it } from 'vitest'
import { serveFetch } from '~/tests/dom/http'

it('keeps the newer table live when an older table is disposed first', async () => {
  const nativeFetch = globalThis.fetch
  const first = serveFetch({
    'GET /api/admin/dispose-order': () => ({ body: { source: 'first' } }),
  })
  const second = serveFetch({
    'GET /api/admin/dispose-order': () => ({ body: { source: 'second' } }),
  })

  first.dispose()
  const response = await fetch('/api/admin/dispose-order')
  await expect(response.json()).resolves.toEqual({ source: 'second' })
  expect(first.calls).toHaveLength(0)
  expect(second.calls).toHaveLength(1)

  second.dispose()
  expect(globalThis.fetch).toBe(nativeFetch)
  await expect(fetch('/api/admin/dispose-order')).rejects.toThrow()
})
