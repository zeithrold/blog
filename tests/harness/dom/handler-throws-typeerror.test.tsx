/*
 * A handler that throws is a fixture bug, whatever it threw. A `TypeError` from a
 * handler must not be mistaken for the transport failure a case is allowed to
 * declare, so the layer records it and the case fails: `a fixture handler threw:
 * TypeError: fixture bug`.
 */
import { expect, it } from 'vitest'
import { serveFetch } from '~/tests/dom/http'

it('swallows a handler that threw a TypeError', async () => {
  serveFetch({
    'GET /api/admin/broken': () => {
      throw new TypeError('fixture bug')
    },
  })
  await expect(fetch('/api/admin/broken')).rejects.toThrow('fixture bug')
})
