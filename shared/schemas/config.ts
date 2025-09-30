import { z } from 'zod'

export const ConfigSchema = z.object({
  token: z.string().nonempty(),
  datasourceId: z.string().nonempty(),
  fields: z.object({
    tag: z.string().nonempty(),
  }),
})
