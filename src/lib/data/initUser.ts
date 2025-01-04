import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { database } from '@/lib/error'
import * as TE from 'fp-ts/TaskEither'

export interface InitUserParams {
  openid: string
  name: string
  email: string
  introduction?: string
}

export default function initUser({
  openid,
  name,
  email,
  introduction,
}: InitUserParams) {
  return TE.tryCatch(
    async () => {
      return db
        .insert(user)
        .values({
          supabase: openid,
          name,
          email,
          introduction,
          role: 'subscriber',
        })
    },
    database,
  )
}
