import type { ReactNode, RefObject } from 'react'
import type { ButtonProps } from '@/components/ui/ztd-me/ui/button'
import type { BlockActionsModel } from '@/features/editor/controls/block-actions/block-actions-model'
import { useDictionary } from '@blocknote/react'
import { Check, ChevronRight, Palette, PanelLeft, PanelTop, Pencil, Trash2 } from 'lucide-react'
import { use } from 'react'
import { Button } from '@/components/ui/ztd-me/client'
import { menuItemClass } from '@/components/ui/ztd-me/ui/classes'
import { cn } from '@/components/ui/ztd-me/ui/cn'
import { EditorMediaContext } from '@/features/editor/media/media-context'
import { useEditorLabels } from '@/i18n/use-labels'
import { useBlogTranslation } from '@/i18n/use-translation'

function BlockActionItem({ icon, trailing, children, className, ...props }: ButtonProps & {
  icon: ReactNode
  trailing?: ReactNode
}): ReactNode {
  return (
    <Button
      {...props}
      type="button"
      variant="ghost"
      size="sm"
      className={cn(
        menuItemClass,
        'w-full justify-start whitespace-normal text-start font-normal max-[701px]:min-h-11',
        'focus-visible:bg-muted focus-visible:outline-none',
        className,
      )}
    >
      <span className="flex size-[18px] shrink-0 items-center justify-center" aria-hidden="true">{icon}</span>
      <span className="min-w-0 flex-1">{children}</span>
      <span className="absolute end-3 top-1/2 flex size-4 -translate-y-1/2 items-center" aria-hidden="true">
        {props['aria-pressed'] === true ? <Check size={16} /> : trailing}
      </span>
    </Button>
  )
}

export function BlockActionsList({ model, firstRef }: {
  model: BlockActionsModel
  firstRef: RefObject<HTMLButtonElement | null>
}): ReactNode {
  const { drag_handle: text } = useDictionary()
  const { block, editor } = model
  const hasColors = block !== undefined
    && ('textColor' in block.props || 'backgroundColor' in block.props)
  return (
    <div className="editor-block-action-list grid w-full min-w-0 gap-1" data-block-id={block?.id}>
      <div className="grid gap-1">
        <BlockActionItem
          icon={<Trash2 size={18} />}
          ref={firstRef}
          className="editor-block-delete text-destructive"
          onClick={() => {
            if (block !== undefined) {
              const selection = editor.getSelection()?.blocks
              editor.removeBlocks(selection?.some(item => item.id === block.id) === true ? selection : [block])
              model.setOpen(false)
            }
          }}
        >
          {text.delete_menuitem}
        </BlockActionItem>
        {hasColors && (
          <BlockActionItem
            icon={<Palette size={18} />}
            trailing={<ChevronRight size={16} />}
            onClick={() => model.setPage('colors')}
          >
            {text.colors_menuitem}
          </BlockActionItem>
        )}
      </div>
      <TableHeaderActions model={model} />
      <MediaBlockAction model={model} />
    </div>
  )
}

function TableHeaderActions({ model }: { model: BlockActionsModel }): ReactNode {
  const label = useBlogTranslation('editor').t
  const { drag_handle: text } = useDictionary()
  const { block, editor } = model
  if (block?.type !== 'table') {
    return null
  }
  return (
    <div className="grid gap-1 border-t border-border pt-1">
      <div className="grid gap-1">
        <BlockActionItem
          icon={<PanelTop size={18} />}
          aria-pressed={Boolean(block.content.headerRows)}
          onClick={() => editor.updateBlock(block, {
            content: { ...block.content, headerRows: (block.content.headerRows ?? 0) > 0 ? undefined : 1 },
          })}
        >
          {text.header_row_menuitem}
        </BlockActionItem>
        <BlockActionItem
          icon={<PanelLeft size={18} />}
          aria-pressed={Boolean(block.content.headerCols)}
          onClick={() => editor.updateBlock(block, {
            content: { ...block.content, headerCols: (block.content.headerCols ?? 0) > 0 ? undefined : 1 },
          })}
        >
          {text.header_column_menuitem}
        </BlockActionItem>
      </div>
      <p className="m-0 hidden px-3 py-2 text-help text-muted-foreground min-[701px]:block">
        {label('tableKeyboardHelp')}
      </p>
    </div>
  )
}

function MediaBlockAction({ model }: { model: BlockActionsModel }): ReactNode {
  const media = use(EditorMediaContext)
  const text = useEditorLabels()
  const block = model.block
  if (media === null || block === undefined || !('url' in block.props)) {
    return null
  }
  return (
    <BlockActionItem
      icon={<Pencil size={18} />}
      disabled={media.loading}
      onClick={() => {
        model.setOpen(false)
        media.request(block.id)
      }}
    >
      {text('Edit media')}
    </BlockActionItem>
  )
}
