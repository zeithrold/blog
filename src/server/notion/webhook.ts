import type { NotionBindings } from './bindings'
import { z } from 'zod'
import { canonicalId } from './api'
import { cacheKey } from './cache'

const maximumBytes = 1024 * 1024
const eventSchema = z.object({
  type: z.string(),
  subscription_id: z.string().min(1),
  entity: z.object({ id: z.uuid(), type: z.string() }),
  data: z.object({
    parent: z.object({ id: z.string(), type: z.string() }).optional(),
  }).optional(),
})

async function rawBody(request: Request) {
  const reader = request.body?.getReader()
  if (reader === undefined) {
    return new Uint8Array()
  }
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) {
        break
      }
      length += chunk.value.byteLength
      if (length > maximumBytes) {
        await reader.cancel()
        return null
      }
      chunks.push(chunk.value)
    }
  }
  finally {
    reader.releaseLock()
  }
  const body = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return body
}

async function validSignature(body: Uint8Array<ArrayBuffer>, signature: string | null, secret: string) {
  if (signature === null || !/^sha256=[a-f0-9]{64}$/i.test(signature)) {
    return false
  }
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  )
  const bytes = Uint8Array.from(signature.slice(7).match(/../g) ?? [], value => Number.parseInt(value, 16))
  return await crypto.subtle.verify('HMAC', key, bytes, body)
}

function parseBody<T>(body: Uint8Array, schema: z.ZodType<T>): T | null {
  try {
    const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body))
    const parsed = schema.safeParse(value)
    return parsed.success ? parsed.data : null
  }
  catch (error) {
    if (error instanceof SyntaxError || error instanceof TypeError) {
      return null
    }
    throw error
  }
}

async function setupWebhook(request: Request, bindings: NotionBindings): Promise<Response> {
  const expected = bindings.NOTION_WEBHOOK_SETUP_TOKEN
  const provided = new URL(request.url).searchParams.get('setup')
  if (expected === undefined || expected.length < 32 || provided === null) {
    return new Response(null, { status: 403 })
  }
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(expected),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(expected))
  if (!await crypto.subtle.verify('HMAC', key, signature, encoder.encode(provided))) {
    return new Response(null, { status: 403 })
  }
  const cache = cacheKey(bindings, 'webhook-verification')
  if (request.method === 'GET') {
    const token = await bindings.NOTION_CACHE.get(cache)
    return token === null
      ? new Response(null, { status: 404 })
      : Response.json({ verification_token: token }, { headers: { 'Cache-Control': 'no-store' } })
  }
  if (request.method !== 'POST') {
    return new Response(null, { status: 405, headers: { Allow: 'GET, POST' } })
  }
  const body = await rawBody(request)
  if (body === null) {
    return new Response(null, { status: 413 })
  }
  const challenge = parseBody(body, z.object({ verification_token: z.string().min(1).max(512) }))
  if (challenge === null) {
    return new Response(null, { status: 400 })
  }
  await bindings.NOTION_CACHE.put(cache, challenge.verification_token, { expirationTtl: 600 })
  return new Response(null, { status: 204 })
}

async function invalidate(event: z.infer<typeof eventSchema>, bindings: NotionBindings) {
  if (event.type.startsWith('page.') && event.entity.type === 'page') {
    await Promise.all([
      bindings.NOTION_CACHE.delete(cacheKey(bindings, 'catalog')),
      bindings.NOTION_CACHE.delete(cacheKey(bindings, `page:${event.entity.id}`)),
    ])
  }
  else if (event.type.startsWith('data_source.')
    && canonicalId(event.entity.id) === canonicalId(bindings.NOTION_DATA_SOURCE_ID)) {
    await bindings.NOTION_CACHE.delete(cacheKey(bindings, 'catalog'))
  }
}

async function receiveEvent(request: Request, bindings: NotionBindings, secret: string): Promise<Response> {
  const body = await rawBody(request)
  if (body === null) {
    return new Response(null, { status: 413 })
  }
  if (!await validSignature(body, request.headers.get('X-Notion-Signature'), secret)) {
    return new Response(null, { status: 401 })
  }
  const event = parseBody(body, eventSchema)
  if (event === null) {
    return new Response(null, { status: 400 })
  }
  const subscription = bindings.NOTION_WEBHOOK_SUBSCRIPTION_ID
  if (subscription !== undefined && event.subscription_id !== subscription) {
    return new Response(null, { status: 403 })
  }
  await invalidate(event, bindings)
  return new Response(null, { status: 204 })
}

export async function handleWebhook(request: Request, bindings: NotionBindings): Promise<Response> {
  const secret = bindings.NOTION_WEBHOOK_SECRET
  if ((secret === undefined || secret.length === 0) && bindings.NOTION_WEBHOOK_SETUP_TOKEN !== undefined) {
    return await setupWebhook(request, bindings)
  }
  if (request.method !== 'POST') {
    return new Response(null, { status: 405, headers: { Allow: 'POST' } })
  }
  if (secret === undefined || secret.length === 0) {
    return new Response(null, { status: 503 })
  }
  return await receiveEvent(request, bindings, secret)
}
