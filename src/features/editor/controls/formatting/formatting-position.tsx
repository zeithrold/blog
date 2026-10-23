import type { FormattingToolbarProps } from '@blocknote/react'
import type { UseFloatingOptions } from '@floating-ui/react'
import type { ReactNode } from 'react'
import { isTouchDevice } from '@blocknote/core'
import { FormattingToolbarExtension } from '@blocknote/core/extensions'
import {
  GenericPopover,
  MobileFormattingToolbarController,
  PortalElementOverride,
  useEditorState,
  useExtension,
  useExtensionState,
  useVirtualKeyboard,
} from '@blocknote/react'
import { flip, offset, shift } from '@floating-ui/react'
import { useMemo } from 'react'
import { useEditorPopoverBoundary } from '@/features/editor/adapters/popover-boundary'
import {
  formattingPlacement,
  formattingPlatform,
  formattingReference,
  observeFormattingSelection,
} from '@/features/editor/controls/formatting/formatting-position-model'
import { useRichEditor } from '@/features/editor/engine/use-rich-editor'

type Props = {
  formattingToolbar: (props: FormattingToolbarProps) => ReactNode
  portalElement: HTMLElement | null
  duration: number
  table: boolean
}

export function EditorFormattingToolbarController(props: Props): ReactNode {
  return isTouchDevice() ? <TouchFormattingToolbar {...props} /> : <FloatingFormattingToolbar {...props} />
}

function TouchFormattingToolbar(props: Props): ReactNode {
  const keyboardOpen = useVirtualKeyboard()
  return keyboardOpen
    ? <MobileFormattingToolbarController formattingToolbar={props.formattingToolbar} />
    : <FloatingFormattingToolbar {...props} />
}

function FloatingFormattingToolbar({ formattingToolbar: Toolbar, portalElement, duration, table }: Props): ReactNode {
  const editor = useRichEditor()
  const extension = useExtension(FormattingToolbarExtension)
  const show = useExtensionState(FormattingToolbarExtension)
  const { top } = useEditorPopoverBoundary(show)
  const platform = useMemo(formattingPlatform, [])
  const dom = useEditorState({ editor, on: 'mount', selector: () => editor.domElement, equalityFn: Object.is })
  const alignment = useEditorState({
    editor,
    selector: () => {
      const props = editor.getTextCursorPosition().block.props
      return 'textAlignment' in props ? props.textAlignment : 'left'
    },
  })
  const reference = useMemo(() => formattingReference(editor, dom, () => extension.store.state), [
    dom,
    editor,
    extension.store,
  ])
  const options = useMemo<UseFloatingOptions>(() => ({
    open: show,
    onOpenChange: (open, _event, reason) => {
      extension.store.setState(open)
      if (reason === 'escape-key') {
        editor.focus()
      }
    },
    placement: formattingPlacement(table, alignment),
    platform,
    middleware: [
      offset(10),
      shift({ padding: { top, right: 8, bottom: 8, left: 8 } }),
      flip({ padding: { top, right: 8, bottom: 8, left: 8 } }),
    ],
    whileElementsMounted: (_reference, _floating, update) =>
      observeFormattingSelection(editor, extension.store, update),
  }), [
    alignment,
    editor,
    extension.store,
    platform,
    show,
    table,
    top,
  ])
  return (
    <PortalElementOverride target={portalElement ?? undefined}>
      <GenericPopover
        reference={reference}
        useFloatingOptions={options}
        useTransitionStylesProps={{ duration }}
        useTransitionStatusProps={{ duration }}
        focusManagerProps={{ disabled: true }}
        elementProps={{ style: { zIndex: 40 } }}
      >
        {show && <Toolbar />}
      </GenericPopover>
    </PortalElementOverride>
  )
}
