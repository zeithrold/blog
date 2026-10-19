import type { FormattingToolbarProps } from '@blocknote/react'
import type { ReactElement } from 'react'
import { getFormattingToolbarItems } from '@blocknote/react'
import { createElement } from 'react'
import { DesktopTextColorsButton } from '@/features/editor/controls/formatting/desktop-text-colors'
import { ImmediateFormattingActionContext } from '@/features/editor/controls/formatting/formatting-options-model'
import { CreateEditorLinkButton } from '@/features/editor/controls/links/link-actions'

const primary = new Set([
  'blockTypeSelect',
  'boldStyleButton',
  'italicStyleButton',
  'underlineStyleButton',
])
export function nativeFormattingItems(props: FormattingToolbarProps): ReactElement[] {
  // File replacement uses the application's upload flow; the native FilePanel is disabled.
  return getFormattingToolbarItems(props.blockTypeSelectItems)
    .filter(item => item.key !== 'replaceFileButton')
    .map((item) => {
      if (item.key === 'colorStyleButton') {
        return createElement(DesktopTextColorsButton, { key: item.key })
      }
      return item.key === 'createLinkButton' ? createElement(CreateEditorLinkButton, { key: item.key }) : item
    })
}
export function formattingItems(props: FormattingToolbarProps, secondary = false): ReactElement[] {
  return nativeFormattingItems(props).filter(item => secondary
    ? !primary.has(String(item.key)) && item.key !== 'colorStyleButton'
    : primary.has(String(item.key))).map(item => item.key === 'fileDownloadButton'
    // Preserve user activation for native file downloads that open a browser tab.
    ? createElement(ImmediateFormattingActionContext, { value: true, key: item.key }, item)
    : item)
}
