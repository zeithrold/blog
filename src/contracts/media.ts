import { z } from 'zod'
import { boundedString, UUID } from '@/content/base'

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
