import { z } from 'zod'

export const EntityMetadataSchema = z.object({
  cover: z.string().optional(),
  description: z.string().optional(),
})

export const ContentVersionMetadataSchema = EntityMetadataSchema.extend({
  title: z.string().optional(),
  codeInject: z.object({
    head: z.string().optional(),
    foot: z.string().optional(),
  }).optional(),
})

export const TagMetadataSchema = EntityMetadataSchema.extend({
  color: z.string().optional(),
})

export type ContentVersionMetadata = z.infer<typeof ContentVersionMetadataSchema>

export type TagMetadata = z.infer<typeof TagMetadataSchema>

export type EntityMetadata = z.infer<typeof EntityMetadataSchema>
