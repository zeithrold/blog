import type { TaskProduct } from '@/lib/helper/types'
import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { like, or } from 'drizzle-orm'
import A from 'fp-ts/Array'
import F from 'fp-ts/function'
import O from 'fp-ts/Option'
import T from 'fp-ts/Task'
import { z } from 'zod'

export const SearchUserParamsSchema = z.object({
  name: z.string().optional(),
  email: z.string().optional(),
})

export type SearchUserParams = z.infer<typeof SearchUserParamsSchema>

function prepareSql(params: SearchUserParams) {
  return async () => {
    if (params.name === undefined && params.email === undefined) {
      throw new Error('At least one of name or email must be provided.')
    }
    const where = [
      params.name === undefined ? O.none : O.some(like(user.name, params.name)),
      params.email === undefined ? O.none : O.some(like(user.email, params.email)),
    ]
    return or(...A.compact(where))
  }
}

type PreparedSqlParams = TaskProduct<typeof prepareSql>

function executeSql(where: PreparedSqlParams) {
  return async () => {
    return db
      .query
      .user
      .findMany({
        where,
        limit: 10,
      })
  }
}

type SqlResult = TaskProduct<typeof executeSql>

function taskPostProcessSql(result: SqlResult) {
  return async () => {
    return result.map(item => ({
      openid: item.supabase,
      email: item.email,
      name: item.name,
      introduction: item.introduction,
    }))
  }
}

/**
 * Search for users.
 * @param params The search parameters.
 */
const searchSoft = F.flow(
  prepareSql,
  T.chain(executeSql),
  T.chain(taskPostProcessSql),
)

export default searchSoft
