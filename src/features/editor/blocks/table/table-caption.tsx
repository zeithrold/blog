import type { KeyboardEvent, ReactNode, RefObject } from 'react'
import type { TableTarget } from '@/features/editor/blocks/table/table-controls-model'
import type { Workspace } from '@/features/editor/workspace/editor-types'
import { Plus } from 'lucide-react'
import { useRef, useState } from 'react'
import { Input } from '@/components/ui/ztd-me/client'
import { useBlogTranslation } from '@/i18n/use-translation'

function focusCaption(element: HTMLInputElement | null): void {
  element?.focus({ preventScroll: true })
}

export function TableCaption({
  workspace,
  target,
  width,
}: {
  workspace: Workspace
  target: TableTarget
  width: number
}): ReactNode {
  const text = useBlogTranslation('editor').t
  const { model, draft, busy } = workspace
  const caption = model.envelope.tableAccessibility[target.id]?.caption ?? ''
  const [editing, setEditing] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const finishWithKey = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (!event.nativeEvent.isComposing && (event.key === 'Enter' || event.key === 'Escape')) {
      event.preventDefault()
      setEditing(false)
      requestAnimationFrame(() => buttonRef.current?.focus())
    }
  }
  return (
    <div
      className="editor-table-caption min-w-0 pt-6 font-sans text-control text-muted-foreground"
      style={{ width }}
      onPaste={event => event.stopPropagation()}
    >
      {editing
        ? (
            <Input
              ref={focusCaption}
              aria-label={text('tableCaption')}
              placeholder={text('tableCaptionPlaceholder')}
              className="w-full text-center"
              maxLength={500}
              disabled={busy}
              value={caption}
              onChange={(event) => {
                if (busy) {
                  return
                }
                model.updateFields({
                  tableAccessibility: {
                    ...model.envelope.tableAccessibility,
                    [target.id]: { caption: event.currentTarget.value },
                  },
                })
                draft.changed()
              }}
              onBlur={() => setEditing(false)}
              onKeyDown={finishWithKey}
            />
          )
        : (
            <CaptionButton caption={caption} disabled={busy} buttonRef={buttonRef} edit={() => setEditing(true)} />
          )}
    </div>
  )
}

function CaptionButton({ caption, disabled, buttonRef, edit }: {
  caption: string
  disabled: boolean
  buttonRef: RefObject<HTMLButtonElement | null>
  edit: () => void
}): ReactNode {
  const text = useBlogTranslation('editor').t
  return (
    <button
      ref={buttonRef}
      type="button"
      disabled={disabled}
      aria-label={caption.trim() === '' ? text('addTableCaption') : text('editTableCaption', { caption })}
      className={[
        'group flex min-h-11 w-full items-center justify-center gap-3 rounded-md px-1 py-2',
        'hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-50',
      ].join(' ')}
      onClick={edit}
    >
      {caption.trim() === ''
        ? (
            <>
              <span className="h-px min-w-3 flex-1 bg-border" aria-hidden="true" />
              {/* Native TableView expects mutation targets to be elements, including outside its viewport. */}
              <span
                key={text('addTableCaption')}
                className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 transition-colors
                  group-hover:bg-muted/70 group-focus-visible:bg-muted/70 motion-reduce:transition-none"
              >
                <Plus size={14} aria-hidden="true" />
                {text('addTableCaption')}
              </span>
              <span className="h-px min-w-3 flex-1 bg-border" aria-hidden="true" />
            </>
          )
        : (
            <span
              key={caption}
              className="min-w-0 whitespace-pre-wrap wrap-anywhere rounded-md px-2 py-1 transition-colors
                group-hover:bg-muted/70 group-focus-visible:bg-muted/70 motion-reduce:transition-none"
            >
              {caption}
            </span>
          )}
    </button>
  )
}
