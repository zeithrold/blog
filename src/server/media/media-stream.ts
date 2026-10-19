import type { R2Bucket } from '@cloudflare/workers-types/index.ts'
import { createHash } from 'node:crypto'
import { Problem } from '@/server/http/problem'
import { sniff, validateCaptions } from '@/server/media/media-policy'

type Transfer = {
  body: ReadableStream<Uint8Array>
  bucket: R2Bucket
  key: string
  type: string
  bytes: number
  sha256: string
}

class Inspector {
  readonly hash = createHash('sha256')
  private readonly prefix = new Uint8Array(65536)
  private prefixSize = 0
  private tail = new Uint8Array(0)
  private readonly decoder = new TextDecoder('utf-8', {
    fatal: true,
  })

  private readonly captions: string[] = []
  size = 0
  constructor(private readonly input: Transfer) {}

  chunk(bytes: Uint8Array): void {
    this.size += bytes.byteLength
    if (this.size > this.input.bytes) {
      throw new Problem(422, 'ASSET_LENGTH_MISMATCH')
    }
    this.hash.update(bytes)
    const take = Math.min(bytes.length, this.prefix.length - this.prefixSize)
    this.prefix.set(bytes.subarray(0, take), this.prefixSize)
    this.prefixSize += take
    const tail = new Uint8Array(this.tail.length + Math.min(bytes.length, 16))
    tail.set(this.tail)
    tail.set(bytes.subarray(Math.max(0, bytes.length - 16)), this.tail.length)
    this.tail = tail.slice(Math.max(0, tail.length - 16))
    if (this.input.type.startsWith('text/')) {
      this.decode(bytes)
    }
  }

  private decode(bytes?: Uint8Array): void {
    try {
      this.text(
        this.decoder.decode(bytes, {
          stream: bytes !== undefined,
        }),
      )
    }
    catch (error) {
      if (error instanceof Problem) {
        throw error
      }
      throw new Problem(422, 'ASSET_TEXT_INVALID')
    }
  }

  private text(text: string): void {
    if (Array.from(text).some(controlCharacter)) {
      throw new Problem(422, 'ASSET_TEXT_INVALID')
    }
    if (this.input.type === 'text/vtt') {
      this.captions.push(text)
    }
  }

  finish(): {
    width: number | null
    height: number | null
  } {
    if (this.size !== this.input.bytes) {
      throw new Problem(422, 'ASSET_LENGTH_MISMATCH')
    }
    if (this.hash.digest('hex') !== this.input.sha256) {
      throw new Problem(422, 'ASSET_HASH_MISMATCH')
    }
    if (this.input.type.startsWith('text/')) {
      this.decode()
    }
    if (this.input.type === 'text/vtt') {
      validateCaptions(this.captions.join(''))
    }
    return sniff(
      this.input.type,
      this.prefix.subarray(0, this.prefixSize),
      this.tail,
      this.size,
    )
  }
}
type Writer = {
  write: (chunk: Uint8Array) => Promise<void>
  close: () => Promise<void>
  abort: (reason: unknown) => Promise<void>
}

async function pump(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  writer: Writer,
  inspector: Inspector,
): Promise<{
  width: number | null
  height: number | null
}> {
  try {
    for (;;) {
      const next = await reader.read()
      if (next.done) {
        break
      }
      inspector.chunk(next.value)
      await writer.write(next.value)
    }
    const result = inspector.finish()
    await writer.close()
    return result
  }
  catch (error) {
    await Promise.allSettled([
      reader.cancel(error),
      writer.abort(error),
    ])
    throw error
  }
  finally {
    reader.releaseLock()
  }
}
export async function transfer(input: Transfer): Promise<{
  width: number | null
  height: number | null
}> {
  const fixed = new FixedLengthStream(input.bytes)
  const writer = fixed.writable.getWriter()
  const inspector = new Inspector(input)
  const reader = input.body.getReader()
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      const error = new Problem(408, 'UPLOAD_TIMEOUT')
      reject(error)
      Promise.allSettled([
        reader.cancel(error),
        writer.abort(error),
      ]).catch(() => undefined)
    }, 60000)
  })
  try {
    const stored = input.bucket.put(input.key, fixed.readable, {
      httpMetadata: {
        contentType: input.type,
      },
      customMetadata: {
        sha256: input.sha256,
      },
    })
    const [storedResult, streamResult] = await Promise.race([
      Promise.allSettled([
        stored,
        pump(reader, writer, inspector),
      ]),
      deadline,
    ])
    if (streamResult.status === 'rejected') {
      throw streamResult.reason instanceof Error
        ? streamResult.reason
        : new Error('Stream failed')
    }
    if (storedResult.status === 'rejected') {
      throw storedResult.reason instanceof Error
        ? storedResult.reason
        : new Error('Object write failed')
    }
    return streamResult.value
  }
  finally {
    clearTimeout(timer)
  }
}

function controlCharacter(character: string): boolean {
  const code = character.charCodeAt(0)
  return code < 32 && code !== 9 && code !== 10 && code !== 13
}
