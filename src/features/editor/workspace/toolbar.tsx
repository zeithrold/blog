import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { DocumentModel } from '@/features/editor/workspace/document-model'
import { useEditorState } from '@blocknote/react'
import { ArrowDown, ArrowUp, ImagePlus, Pencil, Pi, Quote, Redo2, TextQuote, Undo2 } from 'lucide-react'
import { Button, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/ztd-me/client'
import { useEditorLabels } from '@/i18n/use-labels'

const utility1Class = [
  'editor-actions sticky top-[calc(var(--admin-appbar-height)_+_var(--admin-header-height))]',
  'z-[10]',
].join(' ')

const utility2Class = [
  'flex flex-wrap gap-[2px] mt-2 mx-0 mb-6 py-1 px-0 border-b border-border bg-background',
].join(' ')

const utility3Class = [
  '[&_button]:border-transparent [&_button]:bg-transparent [&_button]:text-muted-foreground',
].join(' ')

const layout1Class = [
  utility1Class,
  utility2Class,
  utility3Class,
  '[&_button:hover:not(:disabled)]:text-foreground',
].join(' ')

type ToolProps = { label: string, icon: LucideIcon, disabled: boolean, run: () => void }
export function EditorToolbar({ editor, disabled, addMedia, editMedia }: {
  editor: DocumentModel['editor']
  disabled: boolean
  addMedia: () => void
  editMedia: (id: string) => void
}): ReactNode {
  const text = useEditorLabels()
  return (
    <TooltipProvider delayDuration={350}>
      <div className={layout1Class} role="toolbar" aria-label={text('Editor actions')}>
        <Tool label="Undo" icon={Undo2} disabled={disabled} run={() => editor.undo()} />
        <Tool label="Redo" icon={Redo2} disabled={disabled} run={() => editor.redo()} />
        <span className="toolbar-separator [align-self:center] h-6 w-px mx-1 bg-border" />
        <Tool label="Move block up" icon={ArrowUp} disabled={disabled} run={() => editor.moveBlocksUp()} />
        <Tool label="Move block down" icon={ArrowDown} disabled={disabled} run={() => editor.moveBlocksDown()} />
        <span className="toolbar-separator [align-self:center] h-6 w-px mx-1 bg-border" />
        <InlineButtons editor={editor} disabled={disabled} />
        <Tool label="Add media" icon={ImagePlus} disabled={disabled} run={addMedia} />
        <SelectedMediaTool editor={editor} disabled={disabled} edit={editMedia} />
      </div>
    </TooltipProvider>
  )
}
function SelectedMediaTool({ editor, disabled, edit }: {
  editor: DocumentModel['editor']
  disabled: boolean
  edit: (id: string) => void
}): ReactNode {
  const block = useEditorState({ editor, selector: () => editor.getTextCursorPosition().block })
  return 'url' in block.props
    ? <Tool label="Edit media" icon={Pencil} disabled={disabled} run={() => edit(block.id)} />
    : null
}
function Tool({ label, icon: Icon, disabled, run }: ToolProps): ReactNode {
  const text = useEditorLabels()
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={text(label)}
          disabled={disabled}
          onPointerDown={event => event.preventDefault()}
          onClick={() => {
            if (!disabled) {
              run()
            }
          }}
        >
          <Icon size={18} aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{text(label)}</TooltipContent>
    </Tooltip>
  )
}
function InlineButtons({ editor, disabled }: {
  editor: DocumentModel['editor']
  disabled: boolean
}): ReactNode {
  const choices = [
    { label: 'Citation', icon: Quote, content: { type: 'citation', props: { referenceId: '', locator: '' } } },
    { label: 'Footnote reference', icon: TextQuote, content: { type: 'footnoteRef', props: { noteId: '' } } },
    { label: 'Inline formula', icon: Pi, content: { type: 'inlineMath', props: { source: '' } } },
  ] satisfies {
    label: string
    icon: LucideIcon
    content: Parameters<DocumentModel['editor']['insertInlineContent']>[0][number]
  }[]
  return choices.map(item => (
    <Tool
      key={item.label}
      label={item.label}
      icon={item.icon}
      disabled={disabled}
      run={() => editor.insertInlineContent([item.content])}
    />
  ))
}
