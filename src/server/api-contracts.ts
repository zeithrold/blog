import { z } from 'zod'
import { UUID } from '@/content/document'
import { Problem } from '@/server/problem'

const version = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)
const cas = {
  expectedVersion: version,
  expectedLiveGeneration: version,
}
export const createSchema = z.strictObject({
  kind: z.enum(['article', 'page']).optional(),
})
export const saveSchema = z.strictObject({
  expectedVersion: version,
  baseRevisionId: UUID,
  reason: z.enum(['manual', 'autosave']),
  document: z.unknown(),
})
export const restoreSchema = z.strictObject({
  expectedVersion: version,
  revisionId: UUID,
})
export const publishSchema = z.strictObject({
  ...cas,
  revisionId: UUID,
})
export const unpublishSchema = z.strictObject(cas)
export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value)
  if (!result.success) {
    throw new Problem(400, 'INVALID_REQUEST')
  }
  return result.data
}
export function cursor(value: string | null):
  | {
    time: number
    id: string
  }
  | undefined {
  if (value === null || value === '') {
    return undefined
  }
  const split = value.indexOf(':')
  const time = Number(value.slice(0, split))
  const id = value.slice(split + 1)
  if (split < 1 || !Number.isSafeInteger(time) || time < 0 || !UUID.safeParse(id).success) {
    throw new Problem(400, 'INVALID_QUERY')
  }
  return {
    time,
    id,
  }
}
export function respond(value: unknown, status = 200): Response {
  return Response.json(value, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}
