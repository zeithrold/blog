import { ContentError, inspectJSON } from '@/content/document'
import { JSONScanner } from '@/server/http/json-scanner'

export function parseJSON(source: string): unknown {
  new JSONScanner(source).scan()
  try {
    const result: unknown = JSON.parse(source)
    inspectJSON(result)
    return result
  }
  catch (error) {
    if (error instanceof ContentError) {
      throw error
    }
    throw new ContentError('INVALID_JSON', 400)
  }
}
async function boundedBody(body: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const next = await reader.read()
      if (next.done) {
        break
      }
      size += next.value.byteLength
      if (size > 786432) {
        await reader.cancel()
        throw new ContentError('BODY_TOO_LARGE', 413)
      }
      chunks.push(next.value)
    }
  }
  finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}
export async function readJSON(request: Request): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/json') {
    throw new ContentError('UNSUPPORTED_MEDIA_TYPE', 415)
  }
  if (request.body === null) {
    throw new ContentError('INVALID_JSON', 400)
  }
  const bytes = await boundedBody(request.body)
  try {
    return parseJSON(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  }
  catch (error) {
    if (error instanceof ContentError) {
      throw error
    }
    throw new ContentError('INVALID_JSON', 400)
  }
}
