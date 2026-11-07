import type { ReactNode } from 'react'
import type { DeparturePermit } from '@/features/editor/workspace/editor-departure'
import type { Workspace } from '@/features/editor/workspace/editor-types'
import {
  BlockNoteViewRaw,
  ComponentsContext,
  SuggestionMenuController,
} from '@blocknote/react'
import { useEffect, useState } from 'react'
import { Button, useFrontendPreferences } from '@/components/ui/ztd-me/client'
import { cn } from '@/components/ui/ztd-me/ui/cn'
import { editorComponents } from '@/features/editor/adapters/components'
import { EditorTableControls } from '@/features/editor/blocks/table/table-controls'
import { tableCanvasClass } from '@/features/editor/blocks/table/table-controls-utilities'
import { EditorSideMenu } from '@/features/editor/controls/block-actions/side-menu'
import { EditorFormattingControls } from '@/features/editor/controls/formatting/formatting-controls'
import { useSlashItems } from '@/features/editor/controls/slash-items'
import { useEditorMediaUpload } from '@/features/editor/media/editor-upload-model'
import { EditorMediaContext } from '@/features/editor/media/media-context'
import { MediaPanelBridge } from '@/features/editor/media/media-panel-bridge'
import { EditorMediaOverlay } from '@/features/editor/media/media-upload'
import { useEditorDepartureAttachment } from '@/features/editor/workspace/editor-departure-context'
import { useInputGuards } from '@/features/editor/workspace/input-guards'
import { EditorToolbar } from '@/features/editor/workspace/toolbar'
import { EditorText } from '@/i18n/labels'

export function EditorBody({ workspace, permit }: {
  workspace: Workspace
  permit: DeparturePermit | null
}): ReactNode {
  const { model } = workspace
  const { editor } = model
  const [overlay, setOverlay] = useState<HTMLDivElement | null>(null)
  const media = useEditorMediaUpload(workspace, permit)
  useEditorDepartureAttachment(workspace, media.queue)
  return (
    <EditorMediaContext value={media}>
      <EditorToolbar
        editor={editor}
        disabled={workspace.busy || model.uploading}
        addMedia={() => media.request()}
        editMedia={media.request}
      />
      {model.pasteNotice !== '' && (
        <p role="alert">
          {model.pasteNotice}
          {model.pastePlain !== null && (
            <Button
              variant="outline"
              type="button"
              disabled={workspace.busy}
              onClick={() => {
                if (!workspace.busy) {
                  model.pastePlain?.()
                }
              }}
            >
              <EditorText value="Paste as plain text" />
            </Button>
          )}
        </p>
      )}
      <NativeCanvas workspace={workspace} overlay={overlay} />
      <div ref={setOverlay} className="editor-overlays" />
      <EditorMediaOverlay workspace={workspace} model={media} />
    </EditorMediaContext>
  )
}

function NativeCanvas({
  workspace,
  overlay,
}: {
  workspace: Workspace
  overlay: HTMLDivElement | null
}): ReactNode {
  const { model, busy } = workspace
  const { editor, composingRef } = model
  const guards = useInputGuards(workspace)
  const { resolvedMode } = useFrontendPreferences()
  const getItems = useSlashItems(editor)
  useEditorReady(editor)
  return (
    <ComponentsContext value={editorComponents}>
      <BlockNoteViewRaw
        editor={editor}
        theme={resolvedMode}
        className={cn('blog-editor', tableCanvasClass)}
        comments={false}
        attributionTooltip={false}
        emojiPicker={false}
        slashMenu={false}
        sideMenu={false}
        filePanel={false}
        formattingToolbar={false}
        linkToolbar={false}
        tableHandles={false}
        editable={!busy}
        portalElements={{
          default: overlay ?? undefined,
        }}
        applyThemedRoot={element => element.classList.add('blog-editor')}
        {...guards}
      >
        <EditorFormattingControls disabled={busy} composingRef={composingRef} portalElement={overlay} />
        <EditorSideMenu />
        <MediaPanelBridge />
        <EditorTableControls workspace={workspace} editor={editor} disabled={busy} portalElement={overlay} />
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={getItems}
          shouldOpen={() => !composingRef.current}
        />
      </BlockNoteViewRaw>
    </ComponentsContext>
  )
}

function useEditorReady(editor: Workspace['model']['editor']): void {
  useEffect(() => {
    let second = 0
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        performance.mark('cms-editor-ready')
      })
    })
    return () => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
    }
  }, [editor])
}
