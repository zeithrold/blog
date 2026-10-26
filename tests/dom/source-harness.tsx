import type { ReactNode } from 'react'
import type { PreferencePolicy } from '@/components/ui/ztd-me'
import type { Document } from '@/content/document'
import type { OpenDocument } from '@/contracts/documents'
import type { editorSchema } from '@/features/editor/engine/schema'
import type { DocumentModel, Envelope } from '@/features/editor/workspace/document-model'
import type { Workspace } from '@/features/editor/workspace/editor-types'
import { BlockNoteViewRaw, ComponentsContext } from '@blocknote/react'
import { useMemo } from 'react'
import { validateDocument } from '@/content/document'
import { editorComponents } from '@/features/editor/adapters/components'
import { useDraft } from '@/features/editor/draft/persistence'
import { documentAccessibility } from '@/features/editor/engine/document-accessibility'
import { nodes } from '@/features/editor/engine/native'
import { DraftPreviewContext } from '@/features/editor/preview/draft-preview-context'
import { useActions } from '@/features/editor/workspace/actions'
import { EditorHeader } from '@/features/editor/workspace/header'
import { EditorToolbar } from '@/features/editor/workspace/toolbar'
import { BlogFrontend } from '@/i18n/frontend'
import { COMPONENT_TEST_FIXTURES } from '~/tests/components/src/fixtures'

const owner = COMPONENT_TEST_FIXTURES.owner
const csrfToken = COMPONENT_TEST_FIXTURES.csrfToken
const draftPreview = { show: () => {} }

export type SourceHarnessProps = {
  initial: OpenDocument
  editor: typeof editorSchema.BlockNoteEditor
  policy: PreferencePolicy
}

/**
 * Mounts the production toolbar, header, BlockNote views, draft coordinator,
 * and Client. Only fetch is replaced; editor changes travel through BlockNote's
 * real transaction events into the production draft save path.
 */
export function SourceHarness({ initial, editor, policy }: SourceHarnessProps): ReactNode {
  const model = useMemo(() => documentModel(initial, editor), [initial, editor])
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
  return (
    <BlogFrontend
      initialPreferences={{ version: 1, mode: 'light', palette: 'neutral', locale: 'en' }}
      policy={policy}
    >
      <DraftPreviewContext value={draftPreview}>
        <EditorHeader
          workspace={workspace}
          publish={actions.publish}
          remove={actions.remove}
          livePath={null}
          schedules={[]}
        />
        <EditorToolbar
          editor={editor}
          disabled={workspace.busy || model.uploading}
          addMedia={() => {}}
          editMedia={() => {}}
        />
        <ComponentsContext value={editorComponents}>
          <BlockNoteViewRaw
            editor={editor}
            editable={!workspace.busy}
            comments={false}
            emojiPicker={false}
            slashMenu={false}
            sideMenu={false}
            filePanel={false}
            formattingToolbar={false}
            linkToolbar={false}
            tableHandles={false}
          />
        </ComponentsContext>
      </DraftPreviewContext>
    </BlogFrontend>
  )
}

function documentModel(
  initial: OpenDocument,
  editor: typeof editorSchema.BlockNoteEditor,
): DocumentModel {
  const envelope = documentEnvelope(initial.document)
  const composingRef = { current: false }
  return {
    editor,
    envelope,
    nodeItems: nodes(initial.document),
    snapshot: async () => await Promise.resolve(validateDocument({
      ...envelope,
      blocks: editor.document,
      ...documentAccessibility(initial.document, editor.document),
    })),
    composingRef,
    editorLocale: 'en',
    pasteNotice: '',
    uploadFiles: async () => await Promise.resolve(''),
    uploading: false,
    hasUploads: () => false,
    waitUploads: async () => await Promise.resolve(),
    pastePlain: null,
    updateFields: () => {},
  }
}

function documentEnvelope(document: Document): Envelope {
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
