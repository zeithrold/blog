import { createSelectSchema } from 'drizzle-zod'
import { content, user } from '../schema'

export const Content = createSelectSchema(content)
export const Member = createSelectSchema(user)
