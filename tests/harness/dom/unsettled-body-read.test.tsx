import { it } from 'vitest'
import { serveFetch } from '~/tests/dom/http'

it('fails a disposed service whose request body never resolves', async () => {
  let reportPull: () => void = () => {}
  const pullStarted = new Promise<void>((resolve) => {
    reportPull = resolve
  })
  const body = new ReadableStream<Uint8Array>({
    async pull() {
      reportPull()
      await new Promise<void>(() => {})
    },
  })
  const service = serveFetch({
    'POST /api/admin/held-body': () => ({ body: { ok: true } }),
  })
  const requestInit: RequestInit & { duplex: 'half' } = {
    method: 'POST',
    body,
    duplex: 'half',
  }
  const request = new Request(new URL('/api/admin/held-body', window.location.href), requestInit)

  fetch(request).catch(() => undefined)
  await pullStarted
  service.dispose()
})
