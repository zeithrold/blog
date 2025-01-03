import type { TaskProduct } from '@/lib/helper/types'
import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { wrapper } from '@/lib/error'
import { sql } from '@/lib/error/handlers'
import { eq } from 'drizzle-orm'

async function _rawSql(openid: string) {
  return db.query.user.findFirst({
    where: eq(user.supabase, openid),
  }).execute()
}

export function getUser(openid: string) {
  return wrapper(async () => {
    return _rawSql(openid)
  }, sql)
}

export type GetUserResult = Awaited<ReturnType<typeof _rawSql>>
