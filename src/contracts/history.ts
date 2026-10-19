import { z } from 'zod'
import { UUID } from '@/content/base'

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
