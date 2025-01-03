import { createSelectSchema } from 'drizzle-zod'
import { content, tag, user } from '../schema'

export const ContentSelectSchema = createSelectSchema(content)
export const UserSelectSchema = createSelectSchema(user)
export const TagSelectSchema = createSelectSchema(tag)
