import type { FrontendPreferences, Locale } from '@/components/ui/ztd-me'
import type { BlockActionsModel } from '@/features/editor/controls/block-actions/block-actions-model'
import { BlockNoteEditor } from '@blocknote/core'
import { en, zh } from '@blocknote/core/locales'
import { BlockNoteViewRaw } from '@blocknote/react'
import { act, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it } from 'vitest'
import { createPreferencePolicy } from '@/components/ui/ztd-me'
import { BlockActionsList } from '@/features/editor/controls/block-actions/block-actions-list'
import { editorSchema } from '@/features/editor/engine/schema'
import { BlogFrontend } from '@/i18n/frontend'
import { all, one } from './dom'
import { installBrowserShims, setMediaState } from './environment'

const policy = createPreferencePolicy({
  name: 'blog.dom.table-keyboard-help.v1',
  secure: false,
})

const tableId = '11111111-1111-4111-8111-111111111111'
const paragraphId = '22222222-2222-4222-8222-222222222222'

const keyboardHelp = {
  en: 'In a table cell, Alt+F10 focuses column options. Tab reaches row options; Escape returns to the cell.',
  zh: '在表格单元格中，按 Alt+F10 进入列选项。按 Tab 可前往行选项，按 Escape 返回原单元格。',
} as const

function preferences(locale: Locale): FrontendPreferences {
  return { version: 1, mode: 'light', palette: 'neutral', locale }
}

function actionModel(editor: typeof editorSchema.BlockNoteEditor, id: string): BlockActionsModel {
  const block = editor.getBlock(id)
  if (block === undefined) {
    throw new Error(`The BlockNote editor has no block ${id}`)
  }
  return {
    editor,
    block,
    open: false,
    setOpen: () => {},
    page: 'actions',
    setPage: () => {},
    context: { open: false, show: () => {} },
    finishClose: () => {},
  }
}

function ActionLists({ editor }: { editor: typeof editorSchema.BlockNoteEditor }): React.ReactNode {
  const firstRef = useRef<HTMLButtonElement>(null)
  const secondRef = useRef<HTMLButtonElement>(null)
  return (
    <>
      <section data-action-block="table">
        <BlockActionsList model={actionModel(editor, tableId)} firstRef={firstRef} />
      </section>
      <section data-action-block="paragraph">
        <BlockActionsList model={actionModel(editor, paragraphId)} firstRef={secondRef} />
      </section>
    </>
  )
}

function createActionEditor(locale: 'en' | 'zh'): typeof editorSchema.BlockNoteEditor {
  return BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: [
      { id: paragraphId, type: 'paragraph', content: 'Plain text' },
      {
        id: tableId,
        type: 'table',
        content: {
          type: 'tableContent',
          columnWidths: [120],
          rows: [
            {
              cells: [
                {
                  type: 'tableCell',
                  props: { colspan: 1, rowspan: 1, backgroundColor: 'default' },
                  content: 'Table cell',
                },
              ],
            },
          ],
        },
      },
    ],
    dictionary: locale === 'en' ? en : zh,
  })
}

function mountActionLists(locale: 'en' | 'zh'): {
  container: HTMLDivElement
  unmount: () => void
} {
  installBrowserShims()
  setMediaState({ width: 1440, dark: false })
  const editor = createActionEditor(locale)
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  act(() => {
    root.render(
      <BlogFrontend initialPreferences={preferences(locale === 'en' ? 'en' : 'zh-CN')} policy={policy}>
        <BlockNoteViewRaw
          editor={editor}
          editable={false}
          comments={false}
          emojiPicker={false}
          slashMenu={false}
          sideMenu={false}
          filePanel={false}
          formattingToolbar={false}
          linkToolbar={false}
          tableHandles={false}
        >
          <ActionLists editor={editor} />
        </BlockNoteViewRaw>
      </BlogFrontend>,
    )
  })
  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}

for (const locale of ['en', 'zh'] as const) {
  it(`BlockActionsList renders the ${locale} keyboard help only for table blocks`, () => {
    const view = mountActionLists(locale)
    try {
      const table = one(view.container, '[data-action-block="table"] .editor-block-action-list')
      const paragraph = one(view.container, '[data-action-block="paragraph"] .editor-block-action-list')
      expect(table.getAttribute('data-block-id')).toBe(tableId)
      expect(one(table, 'p').textContent.trim()).toBe(keyboardHelp[locale])
      expect(all(table, 'button[aria-pressed]')).toHaveLength(2)
      expect(all(paragraph, 'p')).toHaveLength(0)
      expect(all(paragraph, 'button[aria-pressed]')).toHaveLength(0)
    }
    finally {
      view.unmount()
    }
  })
}
