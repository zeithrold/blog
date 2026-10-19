import type { Mutation } from '@/server/documents/repository-types'
import type { ScheduleRepository } from '@/server/publication/schedules'
import { UUID } from '@/content/document'
import { restoreDeletedSchema } from '@/content/document-list-query'
import { createSchema, restoreSchema, saveSchema } from '@/contracts/documents'
import { publishSchema, scheduleCancelSchema, scheduleInputSchema, unpublishSchema } from '@/contracts/publication'
import { readDocumentListQuery } from '@/server/documents/document-list-query'
import { parse, respond } from '@/server/http/api-contracts'
import { Problem } from '@/server/http/problem'

export async function readDocuments(
  url: URL,
  repository: ScheduleRepository,
): Promise<Response> {
  if (url.pathname === '/api/admin/documents') {
    const query = readDocumentListQuery(url.searchParams)
    return respond(await repository.list(query.cursor, query.filters))
  }
  const match
    = /^\/api\/admin\/documents\/([^/]+)(?:\/(revisions|schedules|schedule)(?:\/([^/]+))?)?$/.exec(
      url.pathname,
    )
  if (match?.[1] === undefined) {
    throw new Problem(404, 'NOT_FOUND')
  }
  const id = parse(UUID, match[1])
  if (match[2] === 'schedules' || match[2] === 'schedule') {
    return respond(await repository.schedules(id))
  }
  if (match[3] !== undefined) {
    return respond(await repository.revision(id, parse(UUID, match[3])))
  }
  if (match[2] !== 'revisions') {
    return respond(await repository.open(id))
  }
  return await readHistory(url, repository, id)
}
async function readHistory(
  url: URL,
  repository: ScheduleRepository,
  id: string,
): Promise<Response> {
  const before = Number(url.searchParams.get('before') ?? Number.MAX_SAFE_INTEGER)
  if (!Number.isSafeInteger(before) || before < 1) {
    throw new Problem(400, 'INVALID_QUERY')
  }
  return respond(await repository.history(id, before))
}
export async function writeDocuments(
  repository: ScheduleRepository,
  input: { url: URL, method: string, body: unknown, mutation: Mutation },
): Promise<Response> {
  const { url, method, body, mutation } = input
  if (url.pathname === '/api/admin/documents' && method === 'POST') {
    return respond(
      await repository.create(parse(createSchema, body).kind ?? 'article', mutation),
      201,
    )
  }
  const deletion = /^\/api\/admin\/documents\/([^/]+)$/.exec(url.pathname)
  if (deletion?.[1] !== undefined && method === 'DELETE') {
    const cas = parse(unpublishSchema, body)
    return respond(
      await repository.deleteDocument(
        parse(UUID, deletion[1]),
        cas.expectedVersion,
        cas.expectedLiveGeneration,
        mutation,
      ),
    )
  }
  return await writeDocumentAction(repository, input)
}
async function writeDocumentAction(
  repository: ScheduleRepository,
  input: Parameters<typeof writeDocuments>[1],
): Promise<Response> {
  const { url, method, body, mutation } = input
  const match = new RegExp(
    '^/api/admin/documents/([^/]+)/'
    + '(revisions|restore|restore-deleted|publish|unpublish|schedules|schedule|cancel-schedule)$',
  ).exec(url.pathname)
  if (match?.[1] === undefined) {
    throw new Problem(404, 'NOT_FOUND')
  }
  const id = parse(UUID, match[1])
  if (match[2] === 'revisions' && method === 'PUT') {
    return respond(
      await repository.save(
        {
          id,
          ...parse(saveSchema, body),
        },
        mutation,
      ),
    )
  }
  if (match[2] === 'schedule' && method === 'DELETE') {
    return await action(repository, { id, action: 'cancel-schedule', body, mutation })
  }
  if (method !== 'POST') {
    throw new Problem(405, 'METHOD_NOT_ALLOWED')
  }
  return await action(repository, {
    id,
    action: match[2] ?? '',
    body,
    mutation,
  })
}
type Action = {
  id: string
  action: string
  body: unknown
  mutation: Mutation
}

async function action(repository: ScheduleRepository, input: Action): Promise<Response> {
  const { id, body, mutation } = input
  switch (input.action) {
    case 'restore-deleted':
      return respond(
        await repository.restoreDeleted(
          id,
          parse(restoreDeletedSchema, body).expectedVersion,
          mutation,
        ),
      )
    case 'restore': {
      const value = parse(restoreSchema, body)
      return respond(
        await repository.restore(id, value.expectedVersion, value.revisionId, mutation),
        201,
      )
    }
    case 'publish':
      return respond(
        await repository.publish(
          {
            id,
            ...parse(publishSchema, body),
          },
          mutation,
        ),
      )
    case 'unpublish':
      return respond(
        await repository.publish(
          {
            id,
            ...parse(unpublishSchema, body),
            revisionId: null,
          },
          mutation,
        ),
      )
    case 'schedule':
    case 'schedules':
      return respond(
        await repository.schedule(id, parse(scheduleInputSchema, body), mutation),
        201,
      )
    case 'cancel-schedule': {
      const value = parse(scheduleCancelSchema, body)
      return respond(
        await repository.cancel(id, value.scheduleId, value.expectedVersion, mutation),
      )
    }
    default:
      throw new Problem(405, 'METHOD_NOT_ALLOWED')
  }
}
