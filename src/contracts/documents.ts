import { z } from 'zod'
import { UUID, validateDocument } from '@/content/document'

export const versionSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)

export const acknowledgementSchema = z.strictObject({
  documentId: UUID,
  version: z.number().int().nonnegative(),
  headRevisionId: UUID,
  liveRevisionId: UUID.nullable(),
  liveGeneration: z.number().int().nonnegative(),
  unchanged: z.boolean().optional(),
})
export const openDocumentSchema = acknowledgementSchema.extend({
  kind: z.enum(['article', 'page']),
  livePath: z.string().nullable(),
  document: z.unknown().transform(input => validateDocument(input)),
})
export const documentListSchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        documentId: UUID,
        kind: z.enum(['article', 'page']),
        title: z.string(),
        version: z.number().int().nonnegative(),
        headRevisionId: UUID,
        liveRevisionId: UUID.nullable(),
        updatedAt: z.number().int(),
        pendingSchedule: z.strictObject({
          revisionId: UUID,
          runAt: z.number().int().nonnegative(),
        }).nullable().optional(),
      }),
    )
    .max(50),
  nextCursor: z.string().nullable(),
})
export const createSchema = z.strictObject({
  kind: z.enum(['article', 'page']).optional(),
})
export const saveSchema = z.strictObject({
  expectedVersion: versionSchema,
  baseRevisionId: UUID,
  reason: z.enum(['manual', 'autosave']),
  document: z.unknown(),
})
export const restoreSchema = z.strictObject({
  expectedVersion: versionSchema,
  revisionId: UUID,
})

export type Acknowledgement = z.infer<typeof acknowledgementSchema>
export type OpenDocument = z.infer<typeof openDocumentSchema>
