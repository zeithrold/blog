import type { ReactNode, RefObject } from 'react'
import type { createPreferencePolicy, Locale } from '@/components/ui/ztd-me'
import type { Document } from '@/content/document'
import type { OpenDocument } from '@/contracts/documents'
import type { editorSchema } from '@/features/editor/engine/schema'
import type { DocumentModel, Envelope } from '@/features/editor/workspace/document-model'
import type { Workspace } from '@/features/editor/workspace/editor-types'
import { BlockNoteViewRaw, ComponentsContext } from '@blocknote/react'
import { useMemo, useRef, useState } from 'react'
import { validateDocument } from '@/content/document'
import { editorComponents } from '@/features/editor/adapters/components'
import { EditorFormattingControls } from '@/features/editor/controls/formatting/formatting-controls'
import { useDraft } from '@/features/editor/draft/persistence'
import { documentAccessibility } from '@/features/editor/engine/document-accessibility'
import { nodes } from '@/features/editor/engine/native'
import { DraftPreviewContext } from '@/features/editor/preview/draft-preview-context'
import { useActions } from '@/features/editor/workspace/actions'
import { EditorHeader } from '@/features/editor/workspace/header'
import { useInputGuards } from '@/features/editor/workspace/input-guards'
import { EditorToolbar } from '@/features/editor/workspace/toolbar'
import { BlogFrontend } from '@/i18n/frontend'
import { COMPONENT_TEST_FIXTURES } from '~/tests/components/src/fixtures'

const draftPreview = { show: () => {} }
const owner = COMPONENT_TEST_FIXTURES.owner
const csrfToken = COMPONENT_TEST_FIXTURES.csrfToken

function envelopeOf(document: Document): Envelope {
  return {
    format: document.format,
    schemaVersion: document.schemaVersion,
    blockSchema: document.blockSchema,
    meta: document.meta,
    references: document.references,
    citationStyle: document.citationStyle,
    mediaAccessibility: document.mediaAccessibility,
    tableAccessibility: document.tableAccessibility,
  }
}

type DocumentModelWithoutComposition = Omit<DocumentModel, 'composingRef'>

function documentModel(
  initial: OpenDocument,
  editor: typeof editorSchema.BlockNoteEditor,
  locale: Locale,
): DocumentModelWithoutComposition {
  const envelope = envelopeOf(initial.document)
  return {
    editor,
    envelope,
    nodeItems: nodes(initial.document),
    snapshot: async () => await Promise.resolve(validateDocument({
      ...envelope,
      blocks: editor.document,
      ...documentAccessibility(initial.document, editor.document),
    })),
    editorLocale: locale,
    pasteNotice: '',
    uploadFiles: async () => await Promise.resolve(''),
    uploading: false,
    hasUploads: () => false,
    waitUploads: async () => await Promise.resolve(),
    pastePlain: null,
    updateFields: () => {},
  }
}

export function LinkHarness({
  initial,
  editor,
  locale,
  mode,
  policy,
}: {
  readonly initial: OpenDocument
  readonly editor: typeof editorSchema.BlockNoteEditor
  readonly locale: 'en' | 'zh'
  readonly mode: 'light' | 'dark'
  readonly policy: ReturnType<typeof createPreferencePolicy>
}): ReactNode {
  const composingRef = useRef(false)
  const model = useMemo(
    () => ({
      ...documentModel(initial, editor, locale === 'zh' ? 'zh-CN' : 'en'),
      composingRef,
    }),
    [
      composingRef,
      editor,
      initial,
      locale,
    ],
  )
  const props = useMemo(() => ({
    initial,
    owner,
    csrfToken,
    reopen: () => {},
  }), [initial])
  const draft = useDraft({ initial, owner, csrfToken, model, recovered: false })
  const actions = useActions({ props, model, draft })
  const workspace: Workspace = {
    props,
    model,
    draft,
    busy: actions.busy,
    run: actions.run,
    perform: actions.perform,
  }
  const guards = useInputGuards(workspace)
  return (
    <LinkWorkspaceShell
      editor={editor}
      locale={locale}
      mode={mode}
      policy={policy}
      actions={actions}
      workspace={workspace}
      composingRef={composingRef}
      guards={guards}
    />
  )
}

function LinkWorkspaceShell({
  editor,
  locale,
  mode,
  policy,
  actions,
  workspace,
  composingRef,
  guards,
}: {
  readonly editor: typeof editorSchema.BlockNoteEditor
  readonly locale: 'en' | 'zh'
  readonly mode: 'light' | 'dark'
  readonly policy: ReturnType<typeof createPreferencePolicy>
  readonly actions: ReturnType<typeof useActions>
  readonly workspace: Workspace
  readonly composingRef: RefObject<boolean>
  readonly guards: ReturnType<typeof useInputGuards>
}): ReactNode {
  return (
    <BlogFrontend
      initialPreferences={{
        version: 1,
        mode,
        palette: 'neutral',
        locale: locale === 'zh' ? 'zh-CN' : 'en',
      }}
      policy={policy}
    >
      <DraftPreviewContext value={draftPreview}>
        <section className="workspace">
          <EditorHeader
            workspace={workspace}
            publish={actions.publish}
            remove={actions.remove}
            livePath={null}
            schedules={[]}
          />
          <LinkEditorCanvas
            editor={editor}
            workspace={workspace}
            composingRef={composingRef}
            mode={mode}
            guards={guards}
          />
        </section>
      </DraftPreviewContext>
    </BlogFrontend>
  )
}

function LinkEditorCanvas({
  editor,
  workspace,
  composingRef,
  mode,
  guards,
}: {
  readonly editor: typeof editorSchema.BlockNoteEditor
  readonly workspace: Workspace
  readonly composingRef: RefObject<boolean>
  readonly mode: 'light' | 'dark'
  readonly guards: ReturnType<typeof useInputGuards>
}): ReactNode {
  const [overlay, setOverlay] = useState<HTMLDivElement | null>(null)
  return (
    <>
      <EditorToolbar
        editor={editor}
        disabled={workspace.busy || workspace.model.uploading}
        addMedia={() => {}}
        editMedia={() => {}}
      />
      <ComponentsContext value={editorComponents}>
        <BlockNoteViewRaw
          editor={editor}
          theme={mode}
          className="blog-editor"
          comments={false}
          emojiPicker={false}
          slashMenu={false}
          sideMenu={false}
          filePanel={false}
          formattingToolbar={false}
          linkToolbar={false}
          tableHandles={false}
          editable={!workspace.busy}
          portalElements={{ default: overlay ?? undefined }}
          applyThemedRoot={element => element.classList.add('blog-editor')}
          {...guards}
        >
          <EditorFormattingControls
            disabled={workspace.busy}
            composingRef={composingRef}
            portalElement={overlay}
          />
        </BlockNoteViewRaw>
      </ComponentsContext>
      <div ref={setOverlay} className="editor-overlays" />
    </>
  )
}
