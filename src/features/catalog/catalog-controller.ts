import type { z } from 'zod'
import type { ChoiceOption } from '@/components/ui/choice-select'
import type { catalogItemSchema } from '@/contracts/catalog'
import type { Envelope } from '@/features/editor/workspace/document-model'
import type { ContentSettingsWorkspace } from '@/features/editor/workspace/editor-types'
import { catalogListSchema } from '@/contracts/catalog'
import { useAdminResource } from '@/shared/admin/resource'

export type CatalogItem = z.infer<typeof catalogItemSchema>
export type CatalogProps = {
  workspace: ContentSettingsWorkspace
  update: (patch: Partial<Envelope>) => void
  kind: 'tag' | 'series'
}

export function useCatalog(props: CatalogProps): {
  options: ChoiceOption[]
  values: string[]
  loading: boolean
  error: string
  load: () => void
  select: (values: string[]) => void
} {
  const resource = useAdminResource(`/api/admin/catalog/${props.kind}`, catalogListSchema)
  const items = resource.data?.items ?? []
  const meta = props.workspace.model.envelope.meta
  const snapshots = props.kind === 'tag'
    ? meta.tags.map(tag => ({ value: tag.id, label: tag.label }))
    : meta.series.map(series => ({ value: series.id, label: series.title }))
  const values = snapshots.map(snapshot => snapshot.value)
  const options = items.map(item => ({
    value: item.id,
    label: item.name,
    disabled: item.retired && !values.includes(item.id),
  }))
  // Keep historical and retired selections visible when the catalog changes or cannot load.
  const historical = snapshots.filter(snapshot => !items.some(item => item.id === snapshot.value))
  options.push(...historical.map(snapshot => ({ ...snapshot, disabled: false })))
  return {
    options,
    values,
    loading: resource.loading,
    error: resource.error,
    load: () => { resource.refresh().catch(() => {}) },
    select: next => props.update({ meta: selectedCatalogMeta(meta, items, props.kind, next) }),
  }
}

export function selectedCatalogMeta(
  meta: Envelope['meta'],
  items: CatalogItem[],
  kind: CatalogProps['kind'],
  values: string[],
): Envelope['meta'] {
  if (kind === 'tag') {
    const tags = [
      ...new Set(values),
    ].slice(0, 50).flatMap((id) => {
      const saved = meta.tags.find(tag => tag.id === id)
      if (saved !== undefined) {
        return [saved]
      }
      const found = items.find(item => item.id === id && !item.retired)
      return found === undefined
        ? []
        : [
            { id: found.id, slug: found.slug, label: found.name },
          ]
    })
    return { ...meta, tags }
  }
  const series = [
    ...new Set(values),
  ].slice(0, 1).flatMap((id) => {
    const saved = meta.series.find(item => item.id === id)
    if (saved !== undefined) {
      return [saved]
    }
    const found = items.find(item => item.id === id && !item.retired)
    return found === undefined
      ? []
      : [
          { id: found.id, slug: found.slug, title: found.name, position: 1000 },
        ]
  })
  return { ...meta, series }
}
