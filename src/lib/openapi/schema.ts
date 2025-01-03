import { z } from 'zod'

export const ErrorResponseSchema = z.object({
  error: z.object({
    id: z.string(),
    description: z.string(),
  }),
  data: z.null(),
}).openapi('ErrorResponse')

export const HeaderResponseSchema = z.object({
  Location: z.string(),
})
