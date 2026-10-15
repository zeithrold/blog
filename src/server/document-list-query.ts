import type { DocumentFilters } from '@/content/document-list-query'
import { z } from 'zod'
import { UUID } from '@/content/document'
import {
  documentFiltersSchema,
  documentListQuerySchema,
  hasDocumentFilters,
} from '@/content/document-list-query'
import { cursor } from '@/server/api-contracts'
import { Problem } from '@/server/problem'

const positionSchema = z.strictObject({
  time: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  id: UUID,
})
const boundCursorSchema = positionSchema.extend({ filters: documentFiltersSchema })
export type DocumentPosition = z.infer<typeof positionSchema>

export function readDocumentListQuery(params: URLSearchParams): {
  filters: DocumentFilters
  cursor: DocumentPosition | undefined
} {
  const entries = [
    ...params.entries(),
  ]
  if (new Set(entries.map(([key]) => key)).size !== entries.length) {
    throw new Problem(400, 'INVALID_QUERY')
  }
  const parsed = documentListQuerySchema.safeParse(Object.fromEntries(entries))
  if (!parsed.success) {
    throw new Problem(400, 'INVALID_QUERY')
  }
  const { cursor: token, ...filters } = parsed.data
  return { filters, cursor: readListCursor(token, filters) }
}

export function listCursor(position: DocumentPosition, filters: DocumentFilters): string {
  if (!hasDocumentFilters(filters)) {
    return `${position.time}:${position.id}`
  }
  const bytes = new TextEncoder().encode(JSON.stringify({ ...position, filters }))
  return `v1.${btoa(String.fromCharCode(...bytes))}`
}

function readListCursor(
  token: string | undefined,
  filters: DocumentFilters,
): DocumentPosition | undefined {
  if (token === undefined || token === '') {
    return undefined
  }
  if (!token.startsWith('v1.')) {
    if (hasDocumentFilters(filters) || !/^\d+:[^:]+$/.test(token)) {
      throw new Problem(400, 'INVALID_QUERY')
    }
    return cursor(token)
  }
  try {
    return boundPosition(token, filters)
  }
  catch {
    throw new Problem(400, 'INVALID_QUERY')
  }
}

function boundPosition(token: string, filters: DocumentFilters): DocumentPosition {
  const bytes = Uint8Array.from(atob(token.slice(3)), char => char.charCodeAt(0))
  const json: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  const bound = boundCursorSchema.parse(json)
  if (JSON.stringify(bound.filters) !== JSON.stringify(filters)) {
    throw new Problem(400, 'INVALID_QUERY')
  }
  return { time: bound.time, id: bound.id }
}
