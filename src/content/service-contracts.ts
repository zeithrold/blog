import { z } from 'zod'
import { boundedString, SLUG, UUID } from '@/content/base'
import { acknowledgementSchema } from '@/content/contracts'

export const assetRoleSchema = z.enum([
  'image',
  'audio',
  'video',
  'file',
  'caption',
  'poster',
])
export const allocateAssetSchema = z.strictObject({
  filename: boundedString(240).min(1),
  role: assetRoleSchema,
  type: boundedString(100).min(1),
  bytes: z.number().int().positive().max(67108864),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
})
export const assetDescriptorSchema = z.strictObject({
  assetId: UUID,
  state: z.enum([
    'uploading',
    'ready',
    'rejected',
    'deleting',
    'deleted',
  ]),
  url: z.string(),
  filename: z.string(),
  type: z.string(),
  bytes: z.number().int().positive(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  role: assetRoleSchema,
})
export const assetAllocationSchema = z.strictObject({
  assetId: UUID,
  state: z.literal('uploading'),
  uploadPath: z.string(),
})
export const assetListSchema = z.strictObject({
  items: z.array(assetDescriptorSchema).max(50),
  nextCursor: z.string().nullable(),
})
export const catalogKindSchema = z.enum(['tag', 'series'])
export const catalogCreateSchema = z.strictObject({
  slug: SLUG,
  name: boundedString(200).min(1),
})
export const catalogUpdateSchema = catalogCreateSchema.extend({
  expectedVersion: z.number().int().nonnegative(),
  retired: z.boolean(),
})
export const catalogItemSchema = z.strictObject({
  id: UUID,
  kind: catalogKindSchema,
  slug: SLUG,
  name: z.string(),
  version: z.number().int().nonnegative(),
  retired: z.boolean(),
})
export const catalogListSchema = z.strictObject({
  items: z.array(catalogItemSchema).max(1000),
})
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

export const resumeInputSchema = z.strictObject({
  expectedGeneration: z.number().int().nonnegative(),
})
export const resumeSchema = z.strictObject({
  state: z.literal('writable'),
  publicGeneration: z.number().int().nonnegative(),
})
export const operationsSchema = z.strictObject({
  publicGeneration: z.number().int(),
  maintenance: z.number().int().min(0).max(1),
  contentBytes: z.number().int(),
  maintenanceSince: z.number().int().nullable(),
  maintenanceOwner: z.string().nullable(),
  databaseBytes: z.number().int(),
  capacity: z.enum([
    'normal',
    'warning',
    'critical',
  ]),
  pendingSchedules: z.number().int(),
  scheduleLagMs: z.number().int(),
  failedSchedules: z.number().int(),
  lastBackupAt: z.number().int().nullable(),
  documents: z.number().int().nonnegative(),
  revisions: z.number().int().nonnegative(),
  readyAssets: z.number().int().nonnegative(),
  assetBytes: z.number().int().nonnegative(),
  searchableDocuments: z.number().int().nonnegative(),
})
