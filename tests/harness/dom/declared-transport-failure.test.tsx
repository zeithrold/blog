/*
 * A declared `lostResponse()` is a legitimate transport failure: even when its
 * handler finishes after `dispose()`, the client reads a network failure and the
 * case passes. This controls the handler-throws fixtures.
 */
import { expect, it } from 'vitest'
import { defer, lostResponse, serveFetch } from '~/tests/dom/http'

it('tolerates a declared transport failure that completes after dispose', async () => {
  const handlerStarted = defer()
  const releaseTransport = defer()
  const api = serveFetch({
    'GET /api/admin/lost': async () => {
      handlerStarted.open()
      await releaseTransport.promise
      return lostResponse()
    },
  })
  const response = fetch('/api/admin/lost')
  await handlerStarted.promise
  api.dispose()
  releaseTransport.open()
  await expect(response).rejects.toThrow('fetch failed')
  await api.expectServed()
})
