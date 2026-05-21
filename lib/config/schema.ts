import { z } from 'zod'

export const BlogConfigSchema = z.object({
  notion: z.object({
    token: z.string().min(1),
    datasourceId: z.string().min(1),
    fields: z.object({
      tag: z.string().min(1),
      draft: z.string().optional(),
    }),
  }),
  site: z.object({
    name: z.string(),
    description: z.string(),
    url: z.string().url().optional(),
  }).optional(),
})

export type BlogConfig = z.infer<typeof BlogConfigSchema>
