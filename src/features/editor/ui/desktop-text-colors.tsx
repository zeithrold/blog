import type { ReactNode } from 'react'
import { ShowSelectionExtension } from '@blocknote/core/extensions'
import { useDictionary, useExtension, usePortalElement } from '@blocknote/react'
import * as Popover from '@radix-ui/react-popover'
import { Palette } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useFrontendPreferences } from '@/components/ui/ztd-me/client'
import { usePortalContainer } from '@/components/ui/ztd-me/ui/portal'
import { ToolbarButton } from '@/features/editor/ui/components-toolbar'
import { EditorTextColors } from '@/features/editor/ui/formatting-text-colors'
import { useEditorPopoverBoundary } from '@/features/editor/ui/popover-boundary'
import { useEditorPopoverFocus } from '@/features/editor/ui/popover-focus'
import { useRichEditor } from '@/features/editor/ui/use-rich-editor'

const utility1Class = [
  'ztd-overlay ztd-menu blog-editor bn-root z-[150] w-80 max-w-[calc(100vw-2rem)] rounded-xl',
  'border',
].join(' ')

const utility2Class = ['bg-popover p-4 font-sans shadow-lg [&_.editor-side]:flex [&_.editor-side]:flex-col'].join(' ')

const utility3Class = [
  '[&_.editor-side]:rounded-[10px] [&_.editor-side]:bg-card',
  '[&_.editor-side]:text-muted-foreground',
].join(' ')

const utility4Class = [
  '[&_.editor-side_.editor-side-button]:w-8 [&_.editor-side_.editor-side-button]:min-w-8',
].join(' ')

const utility5Class = [
  '[&_.editor-side_.editor-side-button]:h-8 [&_.editor-side_.editor-side-button]:min-h-8',
].join(' ')

const utility6Class = [
  '[&_.editor-side_.editor-side-button]:p-0 [&_.editor-side_.editor-side-button]:border-0',
].join(' ')

const utility7Class = [
  'max-[701px]:[&_.editor-side]:w-[50px] max-[701px]:[&_.editor-side_.editor-side-button]:w-11',
].join(' ')

const layout1Class = [
  utility1Class,
  utility2Class,
  '[&_.editor-side]:gap-[2px] [&_.editor-side]:w-[38px] [&_.editor-side]:h-auto',
  '[&_.editor-side]:p-[2px] [&_.editor-side]:border [&_.editor-side]:border-border',
  utility3Class,
  '[&_.editor-side]:shadow-[0_2px_8px_var(--blog-shadow-overlay)]',
  utility4Class,
  utility5Class,
  utility6Class,
  '[&_.editor-side_.editor-side-button]:rounded-[7px]',
  '[&_.editor-side_.editor-side-button]:bg-transparent',
  '[&_.editor-side_.editor-side-button]:text-inherit',
  '[&_.editor-side_.editor-side-button]:[transition:background-color_120ms_ease,_color_120ms_ease]',
  'motion-reduce:[&_.editor-side_.editor-side-button]:transition-none',
  'motion-reduce:[&_.editor-side_.editor-side-button]:duration-0',
  '[&_.editor-side_.editor-side-button:hover]:bg-muted',
  '[&_.editor-side_.editor-side-button:hover]:text-foreground',
  '[&_.editor-side_.editor-side-button[data-state=open]]:bg-muted',
  '[&_.editor-side_.editor-side-button[data-state=open]]:text-foreground',
  utility7Class,
  'max-[701px]:[&_.editor-side_.editor-side-button]:min-w-11',
  'max-[701px]:[&_.editor-side_.editor-side-button]:h-11',
  'max-[701px]:[&_.editor-side_.editor-side-button]:min-h-11',
].join(' ')

export function DesktopTextColorsButton(): ReactNode {
  const editor = useRichEditor()
  const selection = useExtension(ShowSelectionExtension)
  const portal = usePortalElement()
  const inheritedPortal = usePortalContainer()
  const label = useDictionary().formatting_toolbar.colors.tooltip
  const { resolvedMode } = useFrontendPreferences()
  const [open, setOpen] = useState(false)
  const focus = useEditorPopoverFocus(open, restore => restore && editor.focus())
  const boundary = useEditorPopoverBoundary(open)
  useEffect(() => {
    selection.showSelection(open, 'desktopColors')
    return () => selection.showSelection(false, 'desktopColors')
  }, [selection, open])
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <ToolbarButton
          mainTooltip={label}
          label={label}
          isDisabled={!editor.isEditable}
          data-test="colors"
          icon={<Palette size={16} aria-hidden="true" />}
        />
      </Popover.Trigger>
      <Popover.Portal container={inheritedPortal ?? portal}>
        <Popover.Content
          sideOffset={8}
          collisionPadding={boundary}
          className={[
            layout1Class,
            'max-h-[var(--radix-popover-content-available-height)] overflow-y-auto overscroll-contain',
          ].join(' ')}
          data-color-scheme={resolvedMode}
          aria-label={label}
          {...focus}
        >
          <EditorTextColors editor={editor} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
