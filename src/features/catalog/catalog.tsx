'use client'
import type { ReactNode } from 'react'
import type { CatalogEntry } from '@/features/catalog/catalog-model'
import { FolderOpen, Pencil, Plus, RefreshCw, Search, Tags } from 'lucide-react'
import { Button, Input, Label } from '@/components/ui/ztd-me/client'
import { cn } from '@/components/ui/ztd-me/ui/cn'
import { useCatalogEditing } from '@/features/catalog/catalog-editing'
import { useCatalogManager } from '@/features/catalog/catalog-model'
import { EditorText } from '@/i18n/labels'
import { useEditorLabels } from '@/i18n/use-labels'
import { AdminEmpty, AdminFeedback } from '@/shared/admin/feedback'
import { SaveStatus } from '@/shared/admin/save-status'
import { CatalogFormFields } from './catalog-form-fields'
import {
  layout1Class,
  layout2Class,
  layout3Class,
  layout4Class,
  layout5Class,
  layout6Class,
  layout7Class,
  layout8Class,
  layout9Class,
  layout10Class,
  layout11Class,
} from './catalog-layout'
import { utility1Class } from './catalog-utilities'

type Model = ReturnType<typeof useCatalogManager>
type CatalogProps = { kind: 'tag' | 'series', csrfToken: string, owner: string }
export function CatalogManager(props: CatalogProps): ReactNode {
  return <CatalogManagerContent key={`${props.owner}:${props.kind}`} {...props} />
}

function CatalogManagerContent({
  kind,
  csrfToken,
  owner,
}: CatalogProps): ReactNode {
  const model = useCatalogManager(kind, csrfToken, owner)
  const text = useEditorLabels()
  const { query, setQuery } = model
  const { edit, inputRef, confirmation } = useCatalogEditing(model)
  const entries = (model.resource.data?.items ?? []).filter(item =>
    `${item.name} ${item.slug}`.toLocaleLowerCase().includes(query.toLocaleLowerCase().trim()),
  )
  return (
    <section className={layout1Class}>
      <header className={layout2Class}>
        <div>
          <h1 className={layout3Class}>{text(kind === 'tag' ? 'Tags' : 'Series')}</h1>
        </div>
        <Button
          variant="outline"
          type="button"
          disabled={model.busy}
          onClick={(event) => {
            event.currentTarget.focus()
            edit(null)
          }}
        >
          <Plus size={17} aria-hidden="true" />
          <EditorText value={kind === 'tag' ? 'New tag' : 'New series'} />
        </Button>
      </header>
      <p className={[utility1Class, 'leading-[1.6]'].join(' ')}>
        <EditorText value="Organize your writing. Renaming an entry keeps existing published snapshots intact." />
      </p>
      <div className={layout4Class}>
        <section className="catalog-browser min-w-0 [&_.empty-state]:mt-1" aria-label={text('Catalog entries')}>
          <CatalogSearch query={query} setQuery={setQuery} model={model} />
          <AdminFeedback {...model.resource} retry={model.refresh} />
          {model.resource.data !== null && entries.length === 0 && (
            <AdminEmpty
              title="No catalog entries found"
              description="Create an entry or try a different search."
            />
          )}
          <ul className={layout5Class}>
            {entries.map(item => (
              <CatalogRow key={item.id} item={item} disabled={model.busy} edit={edit} />
            ))}
          </ul>
        </section>
        <CatalogForm kind={kind} model={model} input={inputRef} cancel={() => edit(null)} />
      </div>
      {confirmation}
    </section>
  )
}

function CatalogSearch({
  query,
  setQuery,
  model,
}: {
  query: string
  setQuery: (value: string) => void
  model: Model
}): ReactNode {
  const text = useEditorLabels()
  return (
    <div className="admin-toolbar flex flex-wrap items-center gap-[10px] mb-4">
      <Label className={cn('grid gap-2', [
        'admin-search relative flex-1 min-w-40 [&_>_svg]:absolute [&_>_svg]:top-[14px]',
        '[&_>_svg]:left-3 [&_>_svg]:text-muted-foreground [&_>_svg]:pointer-events-none',
        '[&_input]:pl-[38px]',
      ].join(' '))}
      >
        <Search size={16} aria-hidden="true" />
        <span className={layout6Class}>
          <EditorText value="Search catalog" />
        </span>
        <Input
          type="search"
          value={query}
          placeholder={text('Search name or slug')}
          onChange={event => setQuery(event.currentTarget.value)}
        />
      </Label>
      <Button
        variant="outline"
        type="button"
        disabled={model.resource.loading || model.busy}
        onClick={() => {
          model.refresh().catch(() => {})
        }}
      >
        <RefreshCw size={15} aria-hidden="true" />
        <EditorText value="Refresh" />
      </Button>
    </div>
  )
}

function CatalogRow({
  item,
  disabled,
  edit,
}: {
  item: CatalogEntry
  disabled: boolean
  edit: (item: CatalogEntry) => void
}): ReactNode {
  return (
    <li>
      <span className={layout7Class} aria-hidden="true">
        {item.kind === 'tag' ? <Tags size={19} /> : <FolderOpen size={19} />}
      </span>
      <div className={layout8Class}>
        <strong>{item.name}</strong>
        <span>
          /
          {item.kind === 'tag' ? 'tags' : 'series'}
          /
          {item.slug}
        </span>
      </div>
      <span className={layout9Class} data-state={item.retired ? 'draft' : 'live'}>
        <EditorText value={item.retired ? 'Retired' : 'Active'} />
      </span>
      <Button
        variant="outline"
        type="button"
        disabled={disabled}
        onClick={(event) => {
          event.currentTarget.focus()
          edit(item)
        }}
        aria-label={`${useEditorLabels()('Edit')} ${item.name}`}
      >
        <Pencil size={15} aria-hidden="true" />
        <EditorText value="Edit" />
      </Button>
    </li>
  )
}

function formTitle(kind: 'tag' | 'series', creating: boolean): string {
  if (kind === 'tag') {
    return creating ? 'New tag' : 'Edit tag'
  }
  return creating ? 'New series' : 'Edit series'
}

function CatalogForm({
  kind,
  model,
  input,
  cancel,
}: {
  kind: 'tag' | 'series'
  model: Model
  input: React.RefObject<HTMLInputElement | null>
  cancel: () => void
}): ReactNode {
  return (
    <form
      className={layout10Class}
      onSubmit={(event) => {
        event.preventDefault()
        model.save().catch(() => {})
      }}
    >
      <h2><EditorText value={formTitle(kind, model.edit === null)} /></h2>
      {model.dirty && <SaveStatus status="dirty" className="catalog-dirty mt-[-8px] mx-0 mb-0" />}
      <CatalogFormFields model={model} input={input} />
      {model.error !== '' && (
        <p className={layout11Class} role="alert">
          <EditorText value={model.error} />
        </p>
      )}
      {model.notice !== '' && (
        <p className="admin-feedback text-muted-foreground text-help" role="status">
          <EditorText value={model.notice} />
        </p>
      )}
      <div className="actions flex flex-wrap items-center gap-2">
        <Button variant="default" type="submit" disabled={model.busy || !model.dirty}>
          <EditorText value={model.busy ? 'Saving…' : 'Save catalog entry'} />
        </Button>
        {model.edit !== null && (
          <Button
            variant="outline"
            type="button"
            disabled={model.busy}
            onClick={(event) => {
              event.currentTarget.focus()
              cancel()
            }}
          >
            <EditorText value="Cancel" />
          </Button>
        )}
      </div>
    </form>
  )
}
