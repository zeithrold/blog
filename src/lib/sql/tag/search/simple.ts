import type T from 'fp-ts/Task'
import { db } from '@/lib/db'
import { tag } from '@/lib/db/schema'
import { eq, or } from 'drizzle-orm'

/**
 * Search tags simply.
 *
 * `simple` requires tags exactly matches target.
 * @param tags - Tags to search.
 * @returns Simple search result.
 */
export default function simple(tags: string[]): T.Task<string[]> {
  return async () => {
    const where = or(...tags.map(t => eq(tag.name, t)))
    const result = await db
      .select()
      .from(tag)
      .where(where)
    return result.map(item => item.id)
  }
}
