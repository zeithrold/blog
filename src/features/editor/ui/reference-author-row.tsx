import type { ReactNode } from 'react'
import type { useAuthorSort } from '@/features/editor/services/reference-author-sort'
import type { AuthorDraft } from '@/features/editor/services/reference-authors'
import type { AuthorModel } from '@/features/editor/ui/reference-authors'
import * as Menu from '@radix-ui/react-dropdown-menu'
import { ArrowDown, ArrowUp, GripVertical, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/ztd-me/client'
import { useCompactLayout } from '@/hooks/use-compact-layout'
import { useBlogTranslation } from '@/i18n/use-translation'

type Props = {
  row: AuthorDraft
  index: number
  model: AuthorModel
  sort: ReturnType<typeof useAuthorSort>
  move: (from: number, to: number) => void
  groupId: string
  errorId: string | undefined
  edit: (row?: AuthorDraft) => void
}
export function ReferenceAuthorRow(props: Props): ReactNode {
  const { row, index, sort, groupId } = props
  const { t } = useBlogTranslation('editor')
  return (
    <li
      data-author-row={row.id}
      data-dragging={sort.active === row.id || undefined}
      data-over={(sort.over === row.id && sort.active !== row.id) || undefined}
      className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1 rounded-lg border border-border
        p-1 data-[dragging=true]:bg-muted data-[over=true]:border-primary"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="touch-none cursor-grab active:cursor-grabbing"
        aria-label={t('referenceDragAuthor', { number: index + 1 })}
        aria-describedby={`${groupId}-sort-help ${groupId}-keyboard-help`}
        onPointerDown={event => sort.start(event, row.id)}
        onPointerMove={sort.track}
        onPointerUp={sort.finish}
        onPointerCancel={sort.cancel}
        onLostPointerCapture={sort.cancel}
        onKeyDown={(event) => {
          if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault()
            props.move(index, index + (event.key === 'ArrowUp' ? -1 : 1))
          }
          if (event.key === 'Escape' && sort.active !== undefined) {
            event.preventDefault()
            event.stopPropagation()
            sort.cancel()
          }
        }}
      >
        <GripVertical size={14} aria-hidden="true" />
      </Button>
      <div className="flex min-w-0 items-center gap-2">
        <span aria-hidden="true" className="text-help text-muted-foreground">
          {index + 1}
          .
        </span>
        <AuthorName {...props} />
      </div>
      <AuthorActions {...props} />
    </li>
  )
}
function AuthorName({ row, errorId, groupId, edit }: Props): ReactNode {
  const { t } = useBlogTranslation('editor')
  return (
    <button
      type="button"
      id={`${groupId}-${row.id}`}
      data-author-name=""
      data-author-id={row.id}
      aria-label={t('referenceEditAuthor', { name: row.name })}
      aria-describedby={errorId}
      onClick={() => edit(row)}
      className="min-h-11 min-w-0 flex-1 rounded-md px-1 py-2 text-left text-control leading-snug
        break-words hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
    >
      {row.name}
    </button>
  )
}
function AuthorActions(props: Props): ReactNode {
  const { index, row, model, move, edit } = props
  const compact = useCompactLayout()
  const { t } = useBlogTranslation('editor')
  if (compact) {
    return <AuthorActionMenu {...props} />
  }
  return (
    <div className="flex shrink-0">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t('referenceEditAuthor', { name: row.name })}
        onClick={() => edit(row)}
      >
        <Pencil size={14} aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={index === 0}
        aria-label={t('referenceAuthorUp', { number: index + 1 })}
        onClick={() => move(index, index - 1)}
      >
        <ArrowUp size={14} aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={index === model.rows.length - 1}
        aria-label={t('referenceAuthorDown', { number: index + 1 })}
        onClick={() => move(index, index + 1)}
      >
        <ArrowDown size={14} aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t('referenceRemoveAuthorNumber', { number: index + 1 })}
        onClick={() => model.remove(row.id)}
      >
        <Trash2 size={14} aria-hidden="true" />
      </Button>
    </div>
  )
}

function AuthorActionMenu({ index, row, model, move, edit }: Props): ReactNode {
  const { t } = useBlogTranslation('editor')
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('referenceAuthorActions', { number: index + 1 })}
        >
          <MoreHorizontal size={16} aria-hidden="true" />
        </Button>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align="end"
          sideOffset={6}
          data-vaul-no-drag=""
          className="z-120 min-w-44 rounded-xl border border-border bg-surface p-1 shadow-menu text-control
          [&_[role=menuitem]]:flex [&_[role=menuitem]]:min-h-11 [&_[role=menuitem]]:items-center
          [&_[role=menuitem]]:gap-2 [&_[role=menuitem]]:rounded-lg [&_[role=menuitem]]:px-3
          [&_[role=menuitem]]:outline-none [&_[data-highlighted]]:bg-muted [&_[data-disabled]]:opacity-50"
        >
          <Menu.Item onSelect={() => edit(row)}>
            <Pencil size={14} aria-hidden="true" />
            {t('referenceEditAuthorNumber', { number: index + 1 })}
          </Menu.Item>
          <Menu.Item disabled={index === 0} onSelect={() => move(index, index - 1)}>
            <ArrowUp size={14} aria-hidden="true" />
            {t('referenceAuthorUp', { number: index + 1 })}
          </Menu.Item>
          <Menu.Item disabled={index === model.rows.length - 1} onSelect={() => move(index, index + 1)}>
            <ArrowDown size={14} aria-hidden="true" />
            {t('referenceAuthorDown', { number: index + 1 })}
          </Menu.Item>
          <Menu.Item onSelect={() => model.remove(row.id)}>
            <Trash2 size={14} aria-hidden="true" />
            {t('referenceRemoveAuthorNumber', { number: index + 1 })}
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  )
}
