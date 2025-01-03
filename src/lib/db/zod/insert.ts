import { createInsertSchema } from 'drizzle-zod'
import { content, tag, user } from '../schema'

export const ContentInsertSchema = createInsertSchema(content)
export const UserInsertSchema = createInsertSchema(user)
export const TagInsertSchema = createInsertSchema(tag)
