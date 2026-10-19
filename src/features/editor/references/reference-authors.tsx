import type { ReactNode, RefObject } from 'react'
import type { AuthorDraft, referenceAuthorControls } from '@/features/editor/references/reference-authors-model'
import { Plus } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { Button, Label } from '@/components/ui/ztd-me/client'
import { ReferenceAuthorRow } from '@/features/editor/references/reference-author-row'
import { useAuthorSort } from '@/features/editor/references/reference-author-sort'
import { useBlogTranslation } from '@/i18n/use-translation'

export type AuthorModel = ReturnType<typeof referenceAuthorControls>
export function ReferenceAuthors({ model, error, edit }: {
  model: AuthorModel
  error: string | undefined
  edit: (row?: AuthorDraft) => void
}): ReactNode {
  const { t } = useBlogTranslation('editor')
  const id = useId()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const move = (from: number, to: number): void => {
    if (to < 0 || to >= model.rows.length) {
      return
    }
    model.move(from, to)
    setAnnouncement(t('referenceAuthorMoved', { number: from + 1, position: to + 1 }))
  }
  const sort = useAuthorSort(model.rows, rootRef, move)
  const rowProps = {
    model: { ...model, remove: (authorId: string) => {
      const index = model.rows.findIndex(row => row.id === authorId)
      model.remove(authorId)
      focusAfterRemoval(rootRef, index)
    } },
    sort,
    move,
    errorId: error === undefined ? undefined : `${id}-error`,
    groupId: id,
    edit,
  }
  return (
    <div ref={rootRef} data-slot="reference-authors" className="grid min-w-0 gap-2">
      <div className="flex items-center gap-1 text-help text-muted-foreground">
        <Label htmlFor={model.rows[0] === undefined ? `${id}-add` : `${id}-${model.rows[0].id}`}>
          {t('referenceAuthors')}
        </Label>
        <span aria-hidden="true">*</span>
      </div>
      <ol aria-label={t('referenceAuthorList')} className="m-0 grid min-w-0 list-none gap-2 p-0">
        {(expanded ? model.rows : model.rows.slice(0, 5)).map((row, index) => (
          <ReferenceAuthorRow key={row.id} row={row} index={index} {...rowProps} />
        ))}
      </ol>
      <AuthorListActions
        id={id}
        add={() => {
          setExpanded(true)
          edit()
        }}
        count={model.rows.length}
        expanded={expanded}
        toggle={() => setExpanded(current => !current)}
      />
      <p id={`${id}-sort-help`} className="m-0 text-help text-muted-foreground">{t('referenceAuthorsHelp')}</p>
      <span id={`${id}-keyboard-help`} className="sr-only">{t('referenceAuthorSortHelp')}</span>
      <span className="sr-only" role="status">{announcement}</span>
      {error !== undefined && <p id={`${id}-error`} className="m-0 text-help text-destructive" role="alert">{error}</p>}
    </div>
  )
}

function AuthorExpansion({ count, expanded, toggle }: {
  count: number
  expanded: boolean
  toggle: () => void
}): ReactNode {
  const { t } = useBlogTranslation('editor')
  return count > 5
    ? (
        <Button type="button" variant="ghost" onClick={toggle}>
          {expanded ? t('referenceAuthorsCollapse') : t('referenceAuthorsExpand', { count })}
        </Button>
      )
    : null
}

function AuthorListActions({ id, add, count, expanded, toggle }: {
  id: string
  add: () => void
  count: number
  expanded: boolean
  toggle: () => void
}): ReactNode {
  const { t } = useBlogTranslation('editor')
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        id={`${id}-add`}
        data-author-add=""
        aria-label={t('referenceAddAuthor')}
        type="button"
        variant="outline"
        onClick={add}
      >
        <Plus size={16} aria-hidden="true" />
        {t('referenceAddAuthor')}
      </Button>
      <AuthorExpansion count={count} expanded={expanded} toggle={toggle} />
    </div>
  )
}

function focusAfterRemoval(rootRef: RefObject<HTMLDivElement | null>, index: number): void {
  requestAnimationFrame(() => {
    const inputs = rootRef.current?.querySelectorAll<HTMLButtonElement>('[data-author-name]')
    const target = inputs?.[Math.min(index, inputs.length - 1)]
      ?? rootRef.current?.querySelector<HTMLButtonElement>('[data-author-add]')
    target?.focus({ preventScroll: true })
  })
}
