import type { ReactNode } from 'react'
import type { CatalogProps } from '@/features/catalog/catalog-controller'
import { ArrowUpRight } from 'lucide-react'
import { useId } from 'react'
import { SearchableSelect } from '@/components/ui/searchable-select'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Input,
  Label,
} from '@/components/ui/ztd-me/client'
import { useCatalog } from '@/features/catalog/catalog-controller'
import { useEditorLabels } from '@/i18n/use-labels'

const catalogManageClass = [
  'inline-flex min-h-11 shrink-0 items-center gap-1 rounded-md text-help text-muted-foreground',
  'underline-offset-4 transition-colors hover:text-foreground hover:underline',
  'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/40',
  'motion-reduce:transition-none',
].join(' ')

export function CatalogSettings(props: Omit<CatalogProps, 'kind'>): ReactNode {
  const text = useEditorLabels()
  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="classification">
        <AccordionTrigger>{text('Tags and series')}</AccordionTrigger>
        <AccordionContent className="catalog-selection grid gap-5">
          <CatalogKind {...props} kind="tag" />
          <CatalogKind {...props} kind="series" />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
function CatalogKind(props: CatalogProps): ReactNode {
  const model = useCatalog(props)
  const text = useEditorLabels()
  const controlId = useId()
  const tag = props.kind === 'tag'
  return (
    <div className="catalog-field grid min-w-0 gap-2">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <Label htmlFor={controlId}>{text(tag ? 'Tags' : 'Series')}</Label>
        <a
          className={catalogManageClass}
          href={`/admin/${tag ? 'tags' : 'series'}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {text(tag ? 'Manage tags' : 'Manage series')}
          <ArrowUpRight size={14} aria-hidden="true" />
        </a>
      </div>
      <SearchableSelect
        id={controlId}
        label={text(tag ? 'Tags' : 'Series')}
        searchLabel={text(tag ? 'Search tags' : 'Search series')}
        placeholder={text(tag ? 'Select tags' : 'Select series')}
        emptyLabel={text('No catalog entries found')}
        loadingLabel={text('Loading…')}
        clearLabel={text(tag ? 'Clear tags' : 'Clear series')}
        retryLabel={text('Retry')}
        options={model.options}
        values={model.values}
        onValuesChange={model.select}
        multiple={tag}
        disabled={props.workspace.busy}
        loading={model.loading}
        error={model.error === '' ? '' : text(model.error)}
        onOpen={model.load}
        onRetry={model.load}
      />
      <SeriesPositions {...props} />
    </div>
  )
}
function SeriesPositions({ workspace, update, kind }: CatalogProps): ReactNode {
  const text = useEditorLabels()
  const meta = workspace.model.envelope.meta
  return kind === 'tag'
    ? null
    : meta.series.map(series => (
        <Label className="grid gap-2" key={series.id}>
          {series.title}
          {' '}
          {text('position')}
          <Input
            type="number"
            min={0}
            max={100000}
            disabled={workspace.busy}
            value={series.position}
            onChange={event => update({
              meta: {
                ...meta,
                series: meta.series.map(item => item.id === series.id
                  ? { ...item, position: Number(event.currentTarget.value) }
                  : item),
              },
            })}
          />
        </Label>
      ))
}
