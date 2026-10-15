import { z } from 'zod'
import { UUID, validateDocument } from '@/content/document'

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
export const historySchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        revisionId: UUID,
        sequence: z.number().int().positive(),
        reason: z.string(),
        createdAt: z.number().int(),
        restoredFromId: UUID.nullable(),
        contentSha256: z.string().regex(/^[a-f0-9]{64}$/),
      }),
    )
    .max(50),
  nextBefore: z.number().int().nullable(),
})
export const sessionSchema = z.strictObject({
  csrfToken: z.string().min(1),
  ownerSub: z.string().min(1),
})
