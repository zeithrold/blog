import type { FormattingToolbarProps } from '@blocknote/react'
import type { ReactNode, RefObject } from 'react'
import { FormattingToolbar, LinkToolbarController, useEditorState } from '@blocknote/react'
import { Ellipsis } from 'lucide-react'
import { Button } from '@/components/ui/ztd-me/client'
import { formattingItems, nativeFormattingItems } from '@/features/editor/ui/formatting-items'
import { FormattingOptionsDrawer } from '@/features/editor/ui/formatting-options-drawer'
import {
  FormattingOptionsContext,
  useFormattingOptions,
  useFormattingOptionsModel,
} from '@/features/editor/ui/formatting-options-model'
import { EditorFormattingToolbarController } from '@/features/editor/ui/formatting-position'
import { EditorLinkToolbar } from '@/features/editor/ui/link-actions'
import { EditorLinkCommands } from '@/features/editor/ui/link-command'
import { useCompactLayout } from '@/hooks/use-compact-layout'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useBlogTranslation } from '@/i18n/use-translation'

export function EditorFormattingControls({ disabled, composingRef, portalElement }: {
  disabled: boolean
  composingRef: RefObject<boolean>
  portalElement: HTMLElement | null
}): ReactNode {
  const compact = useCompactLayout(700)
  const duration = useReducedMotion() ? 0 : 160
  const model = useFormattingOptionsModel(compact, disabled, composingRef)
  const table = useEditorState({
    editor: model.editor,
    on: 'selection',
    selector: () => model.editor.getTextCursorPosition().block.type === 'table',
  })
  return (
    <EditorLinkCommands compact={compact} disabled={disabled} composingRef={composingRef}>
      <FormattingOptionsContext value={model}>
        <EditorFormattingToolbarController
          formattingToolbar={ResponsiveFormattingToolbar}
          duration={duration}
          table={table}
          portalElement={portalElement}
        />
        <FormattingOptionsDrawer />
        <LinkToolbarController linkToolbar={EditorLinkToolbar} portalElement={portalElement ?? undefined} />
      </FormattingOptionsContext>
    </EditorLinkCommands>
  )
}

function ResponsiveFormattingToolbar(props: FormattingToolbarProps): ReactNode {
  const compact = useCompactLayout(700)
  const items = nativeFormattingItems(props)
  return (
    <FormattingToolbar {...props}>
      {compact
        ? (
            <>
              {formattingItems(props)}
              <MoreFormattingButton />
            </>
          )
        : items}
    </FormattingToolbar>
  )
}

function MoreFormattingButton(): ReactNode {
  const options = useFormattingOptions()
  const text = useBlogTranslation('editor').t
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="formatting-more-trigger"
      aria-label={text('moreFormattingOptions')}
      aria-haspopup="dialog"
      aria-expanded={options.open}
      onMouseDown={(event) => {
        if (event.button === 0) {
          event.preventDefault()
        }
      }}
      onClick={options.show}
    >
      <Ellipsis size={18} aria-hidden="true" />
    </Button>
  )
}
