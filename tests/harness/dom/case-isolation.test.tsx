import { expect, it } from 'vitest'
import { defer, serveFetch } from '~/tests/dom/http'

const nativeFetch = globalThis.fetch
const path = '/api/admin/case-isolation'

it('leaves an in-flight request for teardown to reject', () => {
  const releaseFirstRequest = defer()
  let requests = 0
  serveFetch({
    'GET /api/admin/case-isolation': async () => {
      requests += 1
      if (requests === 1) {
        await releaseFirstRequest.promise
      }
      return { body: { source: 'earlier case' } }
    },
  })

  fetch(path).catch(() => undefined)
})

it('does not receive the earlier case table answer', async () => {
  expect(globalThis.fetch).toBe(nativeFetch)
  await expect(fetch(path)).rejects.toThrow()
  console.warn('isolation-control: next case used native fetch')
})
