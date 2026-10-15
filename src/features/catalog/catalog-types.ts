import type { z } from 'zod'
import type { catalogItemSchema } from '@/content/service-contracts'

export type CatalogEntry = z.infer<typeof catalogItemSchema>
export type CatalogFields = Pick<CatalogEntry, 'name' | 'slug' | 'retired'>
export type CatalogKind = CatalogEntry['kind']
