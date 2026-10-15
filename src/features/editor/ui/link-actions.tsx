import type { LinkToolbarProps } from '@blocknote/react'
import type { ReactNode } from 'react'
import {
  LinkToolbar,
  OpenLinkButton,
  useComponentsContext,
  useDictionary,
  useEditorState,
} from '@blocknote/react'
import { Link as LinkIcon, Unlink } from 'lucide-react'
import { removeLinkRange, sameLinkTarget, selectedLinkTarget } from '@/features/editor/core/link-target'
import { useEditorLinkCommand } from '@/features/editor/ui/link-context'
import { useRichEditor } from '@/features/editor/ui/use-rich-editor'

export function CreateEditorLinkButton(): ReactNode {
  const editor = useRichEditor()
  const open = useEditorLinkCommand()
  const components = useComponentsContext()
  const dictionary = useDictionary()
  const target = useEditorState({
    editor,
    selector: () => editor.isEditable ? selectedLinkTarget(editor) : null,
    equalityFn: sameLinkTarget,
  })
  if (target === null || components === undefined) {
    return null
  }
  return (
    <components.FormattingToolbar.Button
      data-test="createLink"
      label={dictionary.formatting_toolbar.link.tooltip}
      mainTooltip={dictionary.formatting_toolbar.link.tooltip}
      icon={<LinkIcon size={16} aria-hidden="true" />}
      onClick={() => open(target)}
    />
  )
}

export function EditorLinkToolbar(props: LinkToolbarProps): ReactNode {
  const editor = useRichEditor()
  const open = useEditorLinkCommand()
  const components = useComponentsContext()
  const dictionary = useDictionary()
  if (components === undefined) {
    return null
  }
  return (
    <LinkToolbar {...props}>
      <components.LinkToolbar.Button
        label={dictionary.link_toolbar.edit.text}
        mainTooltip={dictionary.link_toolbar.edit.tooltip}
        onClick={() => {
          const target = {
            mode: 'edit' as const,
            url: props.url,
            text: props.text,
            range: { ...props.range },
            document: editor.prosemirrorState.doc,
          }
          props.setToolbarOpen?.(false)
          props.setToolbarPositionFrozen?.(false)
          open(target)
        }}
      >
        {dictionary.link_toolbar.edit.text}
      </components.LinkToolbar.Button>
      <OpenLinkButton url={props.url} />
      <components.LinkToolbar.Button
        label={dictionary.link_toolbar.delete.tooltip}
        mainTooltip={dictionary.link_toolbar.delete.tooltip}
        icon={<Unlink size={16} aria-hidden="true" />}
        onClick={() => {
          removeLinkRange(editor, props.range)
          props.setToolbarOpen?.(false)
          editor.focus()
        }}
      />
    </LinkToolbar>
  )
}
