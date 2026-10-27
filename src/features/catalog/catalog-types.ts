import type { z } from 'zod'
import type { catalogItemSchema } from '@/contracts/catalog'

export type CatalogEntry = z.infer<typeof catalogItemSchema>
export type CatalogFields = Pick<CatalogEntry, 'name' | 'slug' | 'retired' | 'color'>
export type CatalogKind = CatalogEntry['kind']
