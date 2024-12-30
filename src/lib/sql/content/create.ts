import type { TaskProduct } from '@/lib/helper/types'
import type { Task } from 'fp-ts/Task'
import { db } from '@/lib/db'
import * as dbSchema from '@/lib/db/schema'
import { content as dbContent } from '@/lib/db/schema'
import { ContentVersionMetadataSchema } from '@/lib/db/types'
import F from 'fp-ts/function'
import T from 'fp-ts/Task'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import { makeExcerpt, renderMarkdownHtml, renderMarkdownPlainText } from '../util'

export const CreatePostParamsSchema = z.object({
  title: z.string(),
  content: z.string(),
  slug: z.string(),
  tags: z.array(z.string().uuid()).default([]),
  metadata: ContentVersionMetadataSchema,
  visibility: z.enum(dbSchema.visibilityEnums),
  type: z.enum(dbSchema.typeEnums),
  authors: z.array(z.string().uuid()).optional(),
  primaryAuthor: z.string().uuid(),
  excerpt: z.string().optional(),
})

export type CreatePostParams = z.infer<typeof CreatePostParamsSchema>

function taskDefaultValue(params: CreatePostParams): Task<CreatePostParams> {
  return async () => {
    const { primaryAuthor, content } = params
    let {
      authors,
      excerpt,
    } = params
    if (!authors) {
      authors = [primaryAuthor]
    }
    if (authors.find(author => author === primaryAuthor) === undefined) {
      authors.push(primaryAuthor)
    }
    if (excerpt === undefined) {
      excerpt = await makeExcerpt(content)
    }
    return {
      ...params,
      authors,
      excerpt,
    }
  }
}

function taskPrepareSql(params: CreatePostParams) {
  return async () => {
    const id = uuidv4()
    const contentHtml = await renderMarkdownHtml(params.content)
    const contentPlainText = await renderMarkdownPlainText(params.content)
    return {
      ...params,
      active: true,
      id,
      contentHtml,
      contentPlainText,
    }
  }
}

type PreparedSqlParams = TaskProduct<typeof taskPrepareSql>

function taskSqlInsert(params: PreparedSqlParams) {
  return async () => {
    await db
      .insert(dbContent)
      .values(params)
      .execute()
    return params.id
  }
}

const createIndividual = F.flow(
  taskDefaultValue,
  T.chain(taskPrepareSql),
  T.chain(taskSqlInsert),
)

function createArray(params: CreatePostParams[]): Task<readonly string[]> {
  const tasks: Task<string>[] = params.map(createIndividual)
  return T.sequenceArray(tasks)
}

function create(params: CreatePostParams): Task<string>
function create(params: CreatePostParams[]): Task<readonly string[]>

/**
 * Create a post in the database.
 *
 * The function is a `fp-ts` task, and will not execute until you run it.
 * Combine it with other tasks to create a sequence of operations.
 *
 * @param params The parameters for the post, if it is an array, it will create multiple posts.
 * @returns The UUID of the created post(s).
 */
function create(params: CreatePostParams | CreatePostParams[]): Task<string> | Task<readonly string[]> {
  return Array.isArray(params) ? createArray(params) : createIndividual(params)
}

export default create
