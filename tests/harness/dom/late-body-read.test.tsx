import { expect, it } from 'vitest'
import { serveFetch } from '~/tests/dom/http'

it('records a request-body failure released after disposal', async () => {
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined
  let reportPull: () => void = () => {}
  const pullStarted = new Promise<void>((resolve) => {
    reportPull = resolve
  })
  const body = new ReadableStream<Uint8Array>({
    start(streamController) {
      controller = streamController
    },
    async pull() {
      reportPull()
      await new Promise<void>(() => {})
    },
  })
  const service = serveFetch({
    'POST /api/admin/body-failure': () => ({ body: { ok: true } }),
  })
  const requestInit: RequestInit & { duplex: 'half' } = {
    method: 'POST',
    body,
    duplex: 'half',
  }
  const request = new Request(new URL('/api/admin/body-failure', window.location.href), requestInit)
  const response = fetch(request)

  await pullStarted
  service.dispose()
  controller?.error(new Error('late request body failed'))
  await expect(response).rejects.toThrow('late request body failed')
})
