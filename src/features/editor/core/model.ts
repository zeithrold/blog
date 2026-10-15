import type { Locale } from '@/components/ui/ztd-me'
import type { Document } from '@/content/document'
import type { NodeItem } from '@/features/editor/core/native'
import type { OpenDocument } from '@/features/editor/services/api-client'
import type { MediaInputs } from '@/features/editor/services/media-inputs'
import { en, zh } from '@blocknote/core/locales'
import { useCreateBlockNote } from '@blocknote/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { paste } from '@/features/editor/core/clipboard'
import { codeSyntaxHighlighting } from '@/features/editor/core/code-highlighting'
import { documentAccessibility } from '@/features/editor/core/document-accessibility'
import { nativeBlocks, nodeItem, nodes, sameNode } from '@/features/editor/core/native'
import { editorSchema } from '@/features/editor/core/schema'
import { SnapshotService } from '@/features/editor/core/snapshot'
import { tableWidthLimits } from '@/features/editor/core/table-width-limits'
import { Client } from '@/features/editor/services/api-client'
import { nativeUpload, useMediaInputs } from '@/features/editor/services/media-inputs'
import { useBlogTranslation } from '@/i18n/use-translation'

export type Envelope = Omit<Document, 'blocks'>
export type DocumentModel = {
  editor: typeof editorSchema.BlockNoteEditor
  envelope: Envelope
  nodeItems: NodeItem[]
  snapshot: () => Promise<Document>
  composingRef: React.RefObject<boolean>
  editorLocale: Locale
  pasteNotice: string
  uploadFiles: MediaInputs['uploadFiles']
  uploading: boolean
  hasUploads: MediaInputs['hasUploads']
  waitUploads: MediaInputs['waitUploads']
  pastePlain: (() => void) | null
  updateFields: (patch: Partial<Envelope>) => void
}

export function useDocumentModel(
  initial: OpenDocument,
  locale: Locale,
  csrfToken: string,
  owner: string,
): DocumentModel {
  const [editorLocale] = useState(locale)
  const mediaClient = useMemo(() => new Client(csrfToken, owner), [csrfToken, owner])
  const [envelope, setEnvelope] = useState<Envelope>(() => documentFields(initial.document))
  const fieldsRef = useRef(envelope)
  const composingRef = useRef(false)
  const [clipboard, setClipboard] = useState({ message: '', text: '' })
  const editor = useNativeEditor(initial, editorLocale, composingRef, {
    client: mediaClient,
    fields: fieldsRef,
    update: (patch) => {
      fieldsRef.current = { ...fieldsRef.current, ...patch }
      setEnvelope(fieldsRef.current)
    },
    reject: (message, text) => setClipboard({ message, text }),
  })
  const indexedItems = useNodeItems(editor, initial.document)
  const snapshot = useSnapshot(editor, fieldsRef)
  const updateFields = (patch: Partial<Envelope>): void => {
    fieldsRef.current = {
      ...fieldsRef.current,
      ...patch,
    }
    setEnvelope(fieldsRef.current)
  }
  const media = useMediaInputs({
    composingRef,
    editor,
    client: mediaClient,
    fields: fieldsRef,
    update: updateFields,
  })
  return {
    editor,
    envelope,
    nodeItems: indexedItems,
    snapshot,
    composingRef,
    editorLocale,
    ...media,
    pasteNotice: clipboard.message,
    pastePlain:
      clipboard.text === ''
        ? null
        : () => {
            editor.insertInlineContent([
              { type: 'text', text: clipboard.text, styles: {} },
            ])
            setClipboard({ message: '', text: '' })
          },
    updateFields,
  }
}

function useNativeEditor(
  initial: OpenDocument,
  editorLocale: Locale,
  composingRef: React.RefObject<boolean>,
  clipboard: {
    client: Client
    fields: React.RefObject<Envelope>
    update: (patch: Partial<Envelope>) => void
    reject: (message: string, text: string) => void
  },
): typeof editorSchema.BlockNoteEditor {
  const { t } = useBlogTranslation('editor')
  const initialContent = useMemo(() => nativeBlocks(initial.document), [initial.document])
  const editor: typeof editorSchema.BlockNoteEditor = useCreateBlockNote(
    {
      schema: editorSchema,
      extensions: [codeSyntaxHighlighting, tableWidthLimits],
      initialContent,
      uploadFile: async (file, id) => await nativeUpload(clipboard.client, editor, file, id),
      resolveFileUrl: async url =>
        await Promise.resolve(
          url.startsWith('/assets/') ? `/api/admin/assets/${url.slice(8)}/content` : url,
        ),
      dictionary: editorLocale === 'zh-CN' ? zh : en,
      domAttributes: {
        editor: {
          'aria-label': t('documentBody'),
          'aria-multiline': 'true',
          'class': 'font-serif text-reading',
        },
        blockGroup: { class: '[&>.bn-block-outer+.bn-block-outer]:mt-3' },
        blockContent: { class: 'leading-[var(--ztd-leading-reading)]' },
      },
      pasteHandler: ({ event }): boolean => {
        if (composingRef.current) {
          return false
        }
        clipboard.reject('', '')
        return paste({
          event,
          editor,
          fields: clipboard.fields.current,
          update: clipboard.update,
          reject: clipboard.reject,
        })
      },
    },
    [initial.documentId],
  )
  return editor
}
function useNodeItems(
  editor: typeof editorSchema.BlockNoteEditor,
  initial: Document,
): NodeItem[] {
  const [nodeItems, setNodeItems] = useState(() => nodes(initial))
  useEffect(
    () =>
      editor.onChange((_instance, transaction) => {
        const changes = transaction
          .getChanges()
          .filter(
            change => change.type !== 'update' || !sameNode(change.block, change.prevBlock),
          )
        if (changes.length === 0) {
          return
        }
        setNodeItems((old) => {
          const items = new Map(old.map(item => [item.id, item]))
          for (const change of changes) {
            if (change.type === 'delete') {
              items.delete(change.block.id)
            }
            else {
              items.set(change.block.id, nodeItem(change.block))
            }
          }
          return Array.from(items.values())
        })
      }),
    [editor],
  )
  return nodeItems
}
function useSnapshot(
  editor: typeof editorSchema.BlockNoteEditor,
  fieldsRef: React.RefObject<Envelope>,
): () => Promise<Document> {
  const service = useMemo(() => new SnapshotService(), [])
  const versionRef = useRef(0)
  const cacheRef = useRef<{
    version: number
    fields: Envelope
    promise: Promise<Document>
  } | null>(null)
  useEffect(() => {
    const stop = editor.onChange(() => {
      versionRef.current++
      cacheRef.current = null
    })
    return () => {
      stop()
      service.dispose()
    }
  }, [editor, service])
  return useCallback(async (): Promise<Document> => {
    const fields = fieldsRef.current
    const old = cacheRef.current
    if (old !== null && old.version === versionRef.current && old.fields === fields) {
      return await old.promise
    }
    const start = performance.now()
    const body = editor.document
    const promise = service.read(snapshotInput(body, fields))
    performance.measure('cms-snapshot-capture', { start, end: performance.now() })
    cacheRef.current = { version: versionRef.current, fields, promise }
    try {
      return await promise
    }
    catch (error) {
      cacheRef.current = null
      throw error
    }
  }, [
    editor,
    fieldsRef,
    service,
  ])
}
function snapshotInput(
  body: typeof editorSchema.BlockNoteEditor.document,
  fields: Envelope,
): unknown {
  return { ...fields, blocks: body, ...documentAccessibility(fields, body) }
}

function documentFields(document: Document): Envelope {
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
