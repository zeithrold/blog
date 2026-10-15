import type { ReactNode } from 'react'
import type { Workspace } from '@/features/editor/core/editor-types'
import {
  BlockNoteViewRaw,
  ComponentsContext,
  SuggestionMenuController,
} from '@blocknote/react'
import { useEffect, useState } from 'react'
import { Button, useFrontendPreferences } from '@/components/ui/ztd-me/client'
import { cn } from '@/components/ui/ztd-me/ui/cn'
import { useInputGuards } from '@/features/editor/core/input-guards'
import { useSlashItems } from '@/features/editor/core/slash-items'
import { useEditorMediaUpload } from '@/features/editor/services/editor-upload-model'
import { editorComponents } from '@/features/editor/ui/components'
import { EditorNavigation } from '@/features/editor/ui/editor-navigation'
import { EditorFormattingControls } from '@/features/editor/ui/formatting-controls'
import { EditorMediaContext } from '@/features/editor/ui/media-context'
import { MediaPanelBridge } from '@/features/editor/ui/media-panel-bridge'
import { EditorMediaOverlay } from '@/features/editor/ui/media-upload'
import { EditorSideMenu } from '@/features/editor/ui/side-menu'
import { EditorTableControls } from '@/features/editor/ui/table-controls'
import { tableCanvasClass } from '@/features/editor/ui/table-controls-utilities'
import { EditorToolbar } from '@/features/editor/ui/toolbar'
import { EditorText } from '@/i18n/labels'

export function EditorBody({ workspace }: { workspace: Workspace }): ReactNode {
  const { model } = workspace
  const { editor } = model
  const [overlay, setOverlay] = useState<HTMLDivElement | null>(null)
  const media = useEditorMediaUpload(workspace)
  return (
    <EditorMediaContext value={media}>
      <EditorNavigation workspace={workspace} queue={media.queue} />
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
