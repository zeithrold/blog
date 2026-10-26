import { expect, it } from 'vitest'
import { serveFetch } from '~/tests/dom/http'

it('leaves native fetch unchanged when a service is disposed twice', async () => {
  const nativeFetch = globalThis.fetch
  const service = serveFetch({
    'GET /api/admin/repeat-dispose': () => ({ body: { source: 'table' } }),
  })

  service.dispose()
  const afterFirstDispose = globalThis.fetch
  service.dispose()

  expect(globalThis.fetch).toBe(afterFirstDispose)
  expect(globalThis.fetch).toBe(nativeFetch)
  await expect(fetch('/api/admin/repeat-dispose')).rejects.toThrow()
})
