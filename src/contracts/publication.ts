import { z } from 'zod'
import { boundedString, UUID } from '@/content/base'
import { acknowledgementSchema, versionSchema } from '@/contracts/documents'

const cas = { expectedVersion: versionSchema, expectedLiveGeneration: versionSchema }

export const scheduleInputSchema = z.strictObject({
  expectedVersion: z.number().int().nonnegative(),
  expectedLiveGeneration: z.number().int().nonnegative(),
  revisionId: UUID,
  localTime: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  timezone: boundedString(100).min(1),
  utcOffset: z.number().int().min(-840).max(840),
  runAt: z.number().int().nonnegative(),
})
export const scheduleCancelSchema = z.strictObject({
  scheduleId: UUID,
  expectedVersion: z.number().int().nonnegative(),
})
export const scheduleAckSchema = acknowledgementSchema.extend({
  scheduleId: UUID,
  state: z.enum(['pending', 'cancelled']),
})
export const scheduleItemSchema = z.strictObject({
  id: UUID,
  revisionId: UUID,
  state: z.enum([
    'pending',
    'done',
    'cancelled',
    'failed',
  ]),
  runAt: z.number().int(),
  localTime: z.string(),
  timezone: z.string(),
  utcOffset: z.number().int(),
  attempts: z.number().int(),
  nextAttemptAt: z.number().int(),
  errorCode: z.string().nullable(),
  createdAt: z.number().int(),
})
export const scheduleListSchema = z.strictObject({
  items: z.array(scheduleItemSchema).max(20),
})
export const scheduleTimeSchema = z.strictObject({
  choices: z
    .array(
      z.strictObject({
        runAt: z.number().int(),
        utcOffset: z.number().int(),
      }),
    )
    .max(2),
})
export const publishSchema = z.strictObject({
  ...cas,
  revisionId: UUID,
})
export const unpublishSchema = z.strictObject(cas)
