import type { CatalogEntry, CatalogFields } from '@/features/catalog/catalog-types'

export function rebaseCatalogFields(local: CatalogFields, base: CatalogEntry, remote: CatalogEntry): CatalogFields {
  return {
    name: local.name === base.name ? remote.name : local.name,
    slug: local.slug === base.slug ? remote.slug : local.slug,
    retired: local.retired === base.retired ? remote.retired : local.retired,
    color: local.color === base.color ? remote.color : local.color,
  }
}

export function acceptCatalogEntry(items: CatalogEntry[], saved: CatalogEntry): CatalogEntry[] {
  const next = [
    ...items.filter(item => item.id !== saved.id),
    saved,
  ]
  return next.sort((left, right) => {
    const order = left.name.localeCompare(right.name)
    return order === 0 ? left.id.localeCompare(right.id) : order
  })
}
