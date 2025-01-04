import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { database } from '@/lib/error'
import { and, eq, isNull } from 'drizzle-orm'
import * as TE from 'fp-ts/TaskEither'

export default function getUser(openid: string) {
  return TE.tryCatch(
    async () => {
      return db
        .query
        .user
        .findFirst({
          where: and(
            isNull(user.deletedAt),
            eq(user.supabase, openid),
          ),
        })
        .execute()
    },
    database,
  )
}
