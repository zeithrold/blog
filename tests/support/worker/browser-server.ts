import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Runtime } from './runtime'
import { Buffer } from 'node:buffer'
import { createServer } from 'node:http'
import process from 'node:process'
import { runtime } from './runtime'
import { scenario } from './scenario'

// This disposable Access gateway is only a test entry point and is absent from the Worker build.
function gatewayHeaders(incoming: IncomingMessage, token: string) {
  const headers = new Headers()
  for (const [name, value] of Object.entries(incoming.headers)) {
    if (value !== undefined) {
      headers.set(name, Array.isArray(value) ? value.join(', ') : value)
    }
  }
  headers.delete('cf-access-jwt-assertion')
  if ((headers.get('cookie') ?? '').split('; ').includes('fixture=browser-test')) {
    headers.set('cf-access-jwt-assertion', token)
  }
  return headers
}
type GatewayContext = Runtime & { tokenCreatedAt: number }

async function gateway(context: GatewayContext, incoming: IncomingMessage, outgoing: ServerResponse) {
  if (incoming.url === '/__fixture/login') {
    outgoing.writeHead(302, {
      'location': '/admin',
      'set-cookie': 'fixture=browser-test; HttpOnly; SameSite=Strict; Path=/',
    })
    outgoing.end()
    return
  }
  if (Date.now() - context.tokenCreatedAt > 600000) {
    context.token = await context.jwt()
    context.tokenCreatedAt = Date.now()
  }
  const parts = []
  let size = 0
  for await (const chunk of incoming) {
    const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))
    size += part.length
    if (size > 67108864) {
      throw new Error('Test body exceeds 64 MiB')
    }
    parts.push(part)
  }
  const response = await context.fixture.dispatchFetch(
    new URL(incoming.url ?? '/', context.origin),
    {
      method: incoming.method,
      headers: Object.fromEntries(gatewayHeaders(incoming, context.token)),
      body: parts.length > 0 ? Buffer.concat(parts) : undefined,
      redirect: 'manual',
    },
  )
  outgoing.writeHead(response.status, Object.fromEntries(response.headers))
  outgoing.end(Buffer.from(await response.arrayBuffer()))
}
async function main() {
  const port = Number(process.env.BLOG_TEST_PORT ?? 8801)
  const fresh = async (): Promise<GatewayContext> => ({
    ...await runtime(`http://127.0.0.1:${port}`),
    tokenCreatedAt: Date.now(),
  })
  let context = await fresh()
  const server = createServer((incoming, outgoing) => {
    if (incoming.url === '/__fixture/scenario') {
      scenario(context, incoming, outgoing).catch((error: unknown) => {
        console.error(error)
        outgoing.writeHead(500).end('Local scenario failed')
      })
      return
    }
    if (incoming.url === '/__fixture/reset') {
      if (incoming.method !== 'POST' || incoming.headers.host !== `127.0.0.1:${port}`
        || incoming.headers['sec-fetch-site'] === 'cross-site') {
        outgoing.writeHead(403)
        outgoing.end()
        return
      }
      fresh().then(async (next) => {
        const previous = context
        context = next
        await previous.dispose()
        outgoing.writeHead(204)
        outgoing.end()
      }).catch((error: unknown) => {
        console.error(error)
        outgoing.writeHead(500)
        outgoing.end('Local fixture reset failed')
      })
      return
    }
    gateway(context, incoming, outgoing).catch((error: unknown) => {
      console.error(error)
      outgoing.writeHead(500)
      outgoing.end('Local fixture failed')
    })
  })
  server.listen(port, '127.0.0.1')
  const close = async () => {
    server.close()
    await context.dispose()
    process.exit(0)
  }
  process.on('SIGTERM', () => {
    close().catch(console.error)
  })
  process.on('SIGINT', () => {
    close().catch(console.error)
  })
}
main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
