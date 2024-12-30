import type { TagMetadata } from '@/lib/db/types'
import type T from 'fp-ts/Task'
import { db } from '@/lib/db'
import { tag } from '@/lib/db/schema'
import { like, or } from 'drizzle-orm'

export interface SoftSearchTagResult {
  name: string
  id: string
  slug: string
  metadata?: TagMetadata
}

export default function soft(tags: string[]): T.Task<SoftSearchTagResult[]> {
  return async () => {
    const where = or(...tags.map(t => like(tag.name, t)))
    const result = await db
      .select()
      .from(tag)
      .where(where)
    return result.map(item => ({
      name: item.name,
      id: item.id,
      slug: item.slug,
      metadata: item.metadata,
    }))
  }
}
