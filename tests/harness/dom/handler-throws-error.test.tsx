/*
 * The same rule for a plain error, which must not be treated as a client-visible
 * HTTP problem either: `a fixture handler threw: Error: fixture bug`.
 */
import { expect, it } from 'vitest'
import { serveFetch } from '~/tests/dom/http'

it('swallows a handler that threw', async () => {
  serveFetch({
    'GET /api/admin/broken': () => {
      throw new Error('fixture bug')
    },
  })
  await expect(fetch('/api/admin/broken')).rejects.toThrow('fixture bug')
})
