import { z } from 'zod'

export const sessionSchema = z.strictObject({
  csrfToken: z.string().min(1),
  ownerSub: z.string().min(1),
})
