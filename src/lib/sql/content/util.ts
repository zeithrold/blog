import { content } from '@/lib/db/schema'
import { or, sql } from 'drizzle-orm'

export function fulltext(search: string) {
  return or(
    sql`to_tsvector('english', ${content.title}) @@ websearch_to_tsquery('english', ${search})`,
    sql`to_tsvector('english', ${content.contentPlainText}) @@ websearch_to_tsquery('english', ${search})`,
  )
}
