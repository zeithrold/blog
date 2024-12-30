import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export default function get(openid: string) {
  return async () => {
    return db
      .query
      .user
      .findFirst({
        where: eq(user.supabase, openid),
      })
      .execute()
  }
}
