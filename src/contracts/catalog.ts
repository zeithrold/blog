import { z } from 'zod'
import { boundedString, SLUG, UUID } from '@/content/base'

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
