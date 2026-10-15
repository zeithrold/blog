import type { z as Zod } from 'zod'
import { z } from 'zod'

export const documentFiltersSchema = z.strictObject({
  q: z.string().max(120).trim().default(''),
  kind: z.enum([
    'all',
    'article',
    'page',
  ]).default('all'),
  state: z.enum([
    'all',
    'draft',
    'published',
    'changed',
    'deleted',
  ]).default('all'),
})
export const documentListQuerySchema = documentFiltersSchema.extend({
  cursor: z.string().max(2048).optional(),
})
export const restoreDeletedSchema = z.strictObject({
  expectedVersion: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
})
export type DocumentFilters = Zod.infer<typeof documentFiltersSchema>
export const defaultDocumentFilters: DocumentFilters = documentFiltersSchema.parse({})

export function hasDocumentFilters(filters: DocumentFilters): boolean {
  return filters.q !== '' || filters.kind !== 'all' || filters.state !== 'all'
}

export function documentListPath(filters: DocumentFilters, cursor?: string): string {
  const params = new URLSearchParams()
  if (filters.q !== '') {
    params.set('q', filters.q)
  }
  if (filters.kind !== 'all') {
    params.set('kind', filters.kind)
  }
  if (filters.state !== 'all') {
    params.set('state', filters.state)
  }
  if (cursor !== undefined) {
    params.set('cursor', cursor)
  }
  const query = params.toString()
  return `/api/admin/documents${query === '' ? '' : `?${query}`}`
}
