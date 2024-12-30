import { createInsertSchema } from 'drizzle-zod'
import { content, user } from '../schema'

export const Content = createInsertSchema(content)
export const Member = createInsertSchema(user)
