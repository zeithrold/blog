import type { R2ObjectBody } from '@cloudflare/workers-types/index.ts'

export function r2Body(object: R2ObjectBody): ReadableStream<Uint8Array> {
  const reader = object.body.getReader()
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const result = await reader.read()
      if (result.done) {
        controller.close()
        reader.releaseLock()
        return
      }
      const value: unknown = result.value
      if (!(value instanceof Uint8Array)) {
        throw new TypeError('Invalid R2 body chunk')
      }
      controller.enqueue(value)
    },
    async cancel(reason: unknown) {
      await reader.cancel(reason)
      reader.releaseLock()
    },
  })
}
