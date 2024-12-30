import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export default function getRole(openid: string) {
  return async () => {
    return (await db
      .query
      .user
      .findFirst({
        where: eq(user.supabase, openid),
      })
      .execute())?.role
  }
}
