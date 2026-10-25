import type { ServerResponse } from 'node:http'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { expect, test } from '~/tests/support/browser/test'

type Phase = 'headers' | 'body'

async function prefetchServer(phase: Phase) {
  // Serve the installed native queue, not a copied implementation. The snapshot
  // integration is covered against native snapshotRscResponse in the unit tests.
  const moduleUrl = new URL(import.meta.resolve('vinext/shims/internal/app-prefetch-fetch-queue'))
  const queue = await readFile(moduleUrl, 'utf8')
  const held = new Set<ServerResponse>()
  let received = 0
  const server = createServer((request, response) => {
    const url = request.url ?? '/'
    if (url === '/queue.js') {
      response.writeHead(200, { 'content-type': 'text/javascript' })
      response.end(queue)
    }
    else if (url.startsWith('/hold/')) {
      received++
      held.add(response)
      response.once('close', () => held.delete(response))
      if (phase === 'body') {
        response.writeHead(200, { 'content-type': 'text/plain' })
        response.write('the response is still streaming')
      }
    }
    else {
      response.writeHead(200, { 'content-type': 'text/html' })
      response.end(url === '/start' ? documentSource() : destinationSource())
    }
  })
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (address === null || typeof address === 'string') {
    throw new Error('The prefetch test server did not bind a port')
  }
  return {
    origin: `http://127.0.0.1:${address.port}`,
    received: () => received,
    close: async () => {
      held.forEach((response) => {
        response.destroy()
      })
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error === undefined) {
            resolve()
          }
          else {
            reject(error)
          }
        })
      })
    },
  }
}

function documentSource(): string {
  return `<!doctype html><h1>Prefetch source</h1>
<script type="module">
import { scheduleAppPrefetchFetch, releaseAppPrefetchFetchSlot } from '/queue.js'
addEventListener('unhandledrejection', () => console.log('unexpected-rejection'))
for (let index = 0; index < 6; index++) {
  scheduleAppPrefetchFetch(signal => {
    console.log('prefetch-dispatch:' + index)
    return fetch('/hold/' + index, { signal })
  }, 'low').then(async response => {
    console.log('prefetch-body:' + index)
    try {
      await response.arrayBuffer()
    } catch (cause) {
      releaseAppPrefetchFetchSlot(response, { cause })
      throw cause
    } finally {
      releaseAppPrefetchFetchSlot(response)
    }
  }).catch(() => {})
}
</script>`
}

function destinationSource(): string {
  return `<!doctype html><h1>Destination</h1>
<script type="importmap">
{"imports":{"vinext/shims/internal/app-prefetch-fetch-queue":"/queue.js"}}
</script>`
}

for (const phase of ['headers', 'body'] as const) {
  const title = `leaving while prefetch ${phase} are pending does not dispatch into the departing document`
  test(title, async ({ page }) => {
    const server = await prefetchServer(phase)
    const errors: string[] = []
    const dispatches: string[] = []
    const reading: string[] = []
    const unhandled: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', (message) => {
      if (message.text().startsWith('prefetch-dispatch:')) {
        dispatches.push(message.text())
      }
      if (message.text().startsWith('prefetch-body:')) {
        reading.push(message.text())
      }
      if (message.text() === 'unexpected-rejection') {
        unhandled.push(message.text())
      }
    })
    try {
      await page.goto(`${server.origin}/start`)
      await expect.poll(server.received).toBe(4)
      if (phase === 'body') {
        await expect.poll(() => reading.length).toBe(4)
      }
      // The browser itself cancels the four running transports on departure.
      // A pagehide mock is insufficient: WebKit reports failure before pagehide.
      await page.goto(`${server.origin}/destination`)
      await expect(page.getByRole('heading', { name: 'Destination', exact: true })).toBeVisible()
      expect(errors).toEqual([])
      expect(unhandled).toEqual([])
      expect(dispatches).toEqual([
        'prefetch-dispatch:0',
        'prefetch-dispatch:1',
        'prefetch-dispatch:2',
        'prefetch-dispatch:3',
      ])
      expect(await page.evaluate(async () => (await fetch('/data')).status)).toBe(200)
      const next = await page.evaluate(async () => {
        const queue = await import('vinext/shims/internal/app-prefetch-fetch-queue')
        const response = await queue.scheduleAppPrefetchFetch(
          async (signal: AbortSignal) => await fetch('/data', { signal }),
          'low',
        )
        const status = response.status
        await response.arrayBuffer()
        queue.releaseAppPrefetchFetchSlot(response)
        return status
      })
      expect(next).toBe(200)
    }
    finally {
      await server.close()
    }
  })
}
