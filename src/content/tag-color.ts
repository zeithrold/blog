import { z } from 'zod'

export const tagColorSchema = z.enum([
  'neutral',
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'violet',
  'pink',
])
export type TagColor = z.infer<typeof tagColorSchema>
