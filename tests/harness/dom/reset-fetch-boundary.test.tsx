import { expect, it } from 'vitest'
import { resetFetchBoundary, serveFetch } from '~/tests/dom/http'

it('restores native fetch and clears every table on reset', async () => {
  const nativeFetch = globalThis.fetch
  serveFetch({
    'GET /api/admin/reset-boundary': () => ({ body: { source: 'first' } }),
  })
  serveFetch({
    'GET /api/admin/reset-boundary': () => ({ body: { source: 'second' } }),
  })

  resetFetchBoundary()

  expect(globalThis.fetch).toBe(nativeFetch)
  await expect(fetch('/api/admin/reset-boundary')).rejects.toThrow()
})
