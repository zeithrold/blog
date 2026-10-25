import type { MouseEvent, ReactNode } from 'react'
import type { DocumentFilters } from '@/content/document-list-query'
import type { DocumentListCopy } from '@/features/documents/document-list-copy'
import type { DocumentsController, DocumentsState } from '@/features/documents/document-list-model'
import { ListFilter, RotateCw, Search, X } from 'lucide-react'
import { useId } from 'react'
import { ChoiceSelect } from '@/components/ui/choice-select'
import { Button, Input } from '@/components/ui/ztd-me/client'
import { defaultDocumentFilters, documentFiltersSchema, hasDocumentFilters } from '@/content/document-list-query'
import { useHydrated } from '@/hooks/use-hydrated'
import { background } from '@/shared/admin/background'
import {
  utility1Class,
  utility2Class,
  utility3Class,
  utility4Class,
  utility5Class,
  utility6Class,
  utility7Class,
  utility8Class,
  utility9Class,
} from './document-list-filters-utilities'

const layout1Class = [
  utility1Class,
  'rounded-[12px] bg-card [&:focus-within]:border-ring',
  '[&:focus-within]:shadow-[0_0_0_1px_var(--ztd-focus)] [&_>_svg]:ml-[10px]',
  utility2Class,
  utility3Class,
  '[&_input:focus-visible]:[outline:none] [&_>_button]:shrink-0',
].join(' ')

const layout2Class = [utility4Class, 'whitespace-nowrap border-0'].join(' ')

const layout3Class = [utility5Class, '[&_>_svg]:text-muted-foreground'].join(' ')

const layout4Class = [utility6Class, utility7Class].join(' ')

const layout5Class = [
  'document-filter-chip gap-[6px] min-h-9 max-w-full py-1 px-[10px] rounded-full',
  utility8Class,
  '[&_>_span]:whitespace-nowrap',
].join(' ')

const layout6Class = [utility9Class, 'justify-between min-h-11 my-2 mx-0'].join(' ')

type FilterProps = {
  controller: DocumentsController
  state: DocumentsState
  copy: DocumentListCopy
}
type ApplyFilters = (filters: DocumentFilters) => void

function focusSearch(event: MouseEvent<HTMLButtonElement>): void {
  event.currentTarget.form?.querySelector<HTMLInputElement>('input[type="search"]')?.focus()
}

export function DocumentFiltersForm({ controller, state, copy }: FilterProps): ReactNode {
  const hydrated = useHydrated()
  const id = useId()
  const apply: ApplyFilters = filters => background(controller.load(filters), () => {})
  // Until React owns the server-rendered form, a keystroke never reaches the
  // controller and is silently lost, so the controls stay natively disabled until
  // then. In-flight list loads must not disable them; only mutations do.
  const disabled = !hydrated || state.mutation !== null
  return (
    <form
      className="document-filter-bar grid min-w-0 grid-cols-[minmax(0,_1fr)] gap-[10px] mt-2 mx-0 mb-4"
      role="search"
      aria-label={copy.search}
      onSubmit={(event) => {
        event.preventDefault()
        apply({ ...state.filters, q: state.query.trim() })
      }}
    >
      <div className={layout1Class}>
        <label htmlFor={id} className={layout2Class}>
          {copy.search}
        </label>
        <Search size={19} aria-hidden="true" />
        <Input
          id={id}
          type="search"
          value={state.query}
          maxLength={120}
          placeholder={copy.searchPlaceholder}
          disabled={disabled}
          onChange={event => controller.setQuery(event.currentTarget.value)}
        />
        <Button type="submit" disabled={disabled}>{copy.searchSubmit}</Button>
      </div>
      <div className={layout3Class}>
        <ListFilter size={15} aria-hidden="true" />
        <FilterSelect field="kind" state={state} copy={copy} apply={apply} disabled={disabled} />
        <FilterSelect field="state" state={state} copy={copy} apply={apply} disabled={disabled} />
        {(hasDocumentFilters(state.filters) || state.query !== '') && (
          <Button
            type="button"
            variant="ghost"
            className="document-clear-filters min-h-10 ml-auto px-2 text-muted-foreground text-help"
            disabled={disabled}
            onClick={(event) => {
              focusSearch(event)
              apply(defaultDocumentFilters)
            }}
          >
            {copy.clear}
          </Button>
        )}
      </div>
      <ActiveFilters state={state} copy={copy} apply={apply} disabled={disabled} />
    </form>
  )
}

function FilterSelect({ field, state, copy, apply, disabled }: {
  field: 'kind' | 'state'
  state: DocumentsState
  copy: DocumentListCopy
  apply: ApplyFilters
  disabled: boolean
}): ReactNode {
  const values = field === 'kind'
    ? [
        'all',
        'article',
        'page',
      ]
    : [
        'all',
        'draft',
        'published',
        'changed',
        'deleted',
      ]
  return (
    <ChoiceSelect
      className={layout4Class}
      label={field === 'kind' ? copy.kind : copy.state}
      value={state.filters[field]}
      disabled={disabled}
      options={values.map(value => ({ value, label: optionLabel(value, field, copy) }))}
      onValueChange={value => apply(documentFiltersSchema.parse({
        ...state.filters,
        q: state.query,
        [field]: value,
      }))}
    />
  )
}

function optionLabel(value: string, field: 'kind' | 'state', copy: DocumentListCopy): string {
  if (value === 'all') {
    return field === 'kind' ? copy.allKinds : copy.allStates
  }
  if (value === 'article' || value === 'page' || value === 'draft'
    || value === 'published' || value === 'changed' || value === 'deleted') {
    return copy[value]
  }
  return value
}

function ActiveFilters({ state, copy, apply, disabled }: {
  state: DocumentsState
  copy: DocumentListCopy
  apply: ApplyFilters
  disabled: boolean
}): ReactNode {
  const filters = activeFilters(state.filters, copy)
  if (filters.length === 0) {
    return null
  }
  return (
    <ul
      className={[
        'document-active-filters flex flex-wrap gap-2 m-0 p-0 list-none [&_li]:min-w-0',
        '[&_li]:max-w-full',
      ].join(' ')}
      aria-label={copy.activeFilters}
    >
      {filters.map(filter => (
        <li key={filter.field}>
          <Button
            type="button"
            variant="outline"
            className={layout5Class}
            title={filter.label}
            aria-label={`${copy.removeFilter}: ${filter.name}: ${filter.label}`}
            disabled={disabled}
            onClick={(event) => {
              focusSearch(event)
              apply({
                ...state.filters,
                q: state.query,
                [filter.field]: defaultDocumentFilters[filter.field],
              })
            }}
          >
            <span>{filter.label}</span>
            <X size={13} aria-hidden="true" />
          </Button>
        </li>
      ))}
    </ul>
  )
}

function activeFilters(filters: DocumentFilters, copy: DocumentListCopy): {
  field: keyof DocumentFilters
  name: string
  label: string
}[] {
  const result: { field: keyof DocumentFilters, name: string, label: string }[] = []
  if (filters.q !== '') {
    result.push({ field: 'q', name: copy.search, label: filters.q })
  }
  if (filters.kind !== 'all') {
    result.push({ field: 'kind', name: copy.kind, label: optionLabel(filters.kind, 'kind', copy) })
  }
  if (filters.state !== 'all') {
    result.push({ field: 'state', name: copy.state, label: optionLabel(filters.state, 'state', copy) })
  }
  return result
}

export function DocumentListSummary({ controller, state, copy }: FilterProps): ReactNode {
  return (
    <div className={layout6Class}>
      <p aria-live="polite" aria-atomic="true">
        {state.loaded
          ? (
              <>
                <strong>{state.entries.length}</strong>
                {' '}
                {copy.loaded}
                <span className="document-list-order [margin-inline-start:12px] max-[701px]:hidden">{copy.order}</span>
              </>
            )
          : copy.order}
      </p>
      <Button
        type="button"
        variant="ghost"
        className="document-refresh mr-[-12px] text-muted-foreground"
        disabled={state.loading !== null || state.mutation !== null}
        onClick={() => background(controller.load(), () => {})}
      >
        <RotateCw size={15} aria-hidden="true" />
        {copy.refresh}
      </Button>
    </div>
  )
}
