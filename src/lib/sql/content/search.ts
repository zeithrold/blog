import type { TaskProduct } from '@/lib/helper/types'
import { db } from '@/lib/db'
import { content, typeEnums } from '@/lib/db/schema'
import { and, arrayContains, eq } from 'drizzle-orm'
import F from 'fp-ts/function'
import T from 'fp-ts/Task'
import { z } from 'zod'
import { fulltext } from './util'

export const SearchContentParamsSchema = z.object({
  search: z.string(),
  tags: z.array(z.string().uuid()).default([]),
  authors: z.array(z.string().uuid()).default([]),
  type: z.enum(typeEnums),
})

export type SearchContentParams = z.infer<typeof SearchContentParamsSchema>

function taskPrepareSql(params: SearchContentParams) {
  return async () => {
    return and(
      fulltext(params.search),
      arrayContains(content.tags, params.tags),
      arrayContains(content.authors, params.authors),
      eq(content.type, params.type),
    )
  }
}

type PreparedSqlParams = TaskProduct<typeof taskPrepareSql>

function taskExecuteSql(where: PreparedSqlParams) {
  return async () => {
    return db
      .select()
      .from(content)
      .where(where)
  }
}

/**
 * Search for content.
 * @param params The search parameters.
 */
const search = F.flow(
  taskPrepareSql,
  T.chain(taskExecuteSql),
)

export default search
