import type { DocumentFilters } from '@/content/document-list-query'
import type { documentListSchema } from '@/contracts/documents'
import type { DocumentPosition } from '@/server/documents/document-list-query'
import type { Bind } from '@/server/documents/repository-types'

type Entry = ReturnType<typeof documentListSchema.parse>['items'][number]
export type DocumentListRow = Omit<Entry, 'pendingSchedule'> & {
  scheduledRevisionId: string | null
  scheduledRunAt: number | null
}

export function documentListItem(row: DocumentListRow): Entry {
  const { scheduledRevisionId, scheduledRunAt, ...entry } = row
  return {
    ...entry,
    pendingSchedule: scheduledRevisionId !== null && scheduledRunAt !== null
      ? { revisionId: scheduledRevisionId, runAt: scheduledRunAt }
      : null,
  }
}

const publicationConditions = {
  all: '',
  draft: 'd.live_revision_id IS NULL',
  published: 'd.live_revision_id=d.head_revision_id',
  changed: 'd.live_revision_id IS NOT NULL AND d.live_revision_id<>d.head_revision_id',
  deleted: '',
}

export function documentListSQL(filters: DocumentFilters, cursor?: DocumentPosition): {
  query: string
  values: Bind[]
} {
  const conditions = [
    filters.state === 'deleted' ? 'd.deleted_at IS NOT NULL' : 'd.deleted_at IS NULL',
  ]
  const values: Bind[] = []
  addFilters(filters, conditions, values)
  if (cursor !== undefined) {
    conditions.push('(d.updated_at<? OR (d.updated_at=? AND d.id>?))')
    values.push(cursor.time, cursor.time, cursor.id)
  }
  return {
    query: `SELECT d.id AS documentId,d.kind,d.version,d.head_revision_id AS headRevisionId,
      d.live_revision_id AS liveRevisionId,d.updated_at AS updatedAt,
      json_extract(r.canonical_json,'$.meta.title') AS title,
      s.revision_id AS scheduledRevisionId,s.run_at AS scheduledRunAt
      FROM documents d JOIN revisions r ON r.id=d.head_revision_id AND r.document_id=d.id
      LEFT JOIN schedules s ON s.document_id=d.id AND s.state='pending'
      WHERE ${conditions.join(' AND ')} ORDER BY d.updated_at DESC,d.id LIMIT 51`,
    values,
  }
}

function addFilters(filters: DocumentFilters, conditions: string[], values: Bind[]): void {
  if (filters.q !== '') {
    conditions.push('instr(lower(json_extract(r.canonical_json,\'$.meta.title\')),lower(?))>0')
    values.push(filters.q)
  }
  if (filters.kind !== 'all') {
    conditions.push('d.kind=?')
    values.push(filters.kind)
  }
  const state = publicationConditions[filters.state]
  if (state !== '') {
    conditions.push(`(${state})`)
  }
}
