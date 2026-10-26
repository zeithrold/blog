import type { Document } from '@/content/document'
import type { OpenDocument } from '@/contracts/documents'
import type { DocumentModel, Envelope } from '@/features/editor/workspace/document-model'
import { useCallback, useMemo, useRef, useState } from 'react'
import { validateDocument } from '@/content/document'
import { nodes } from '@/features/editor/engine/native'

/*
 * The editor boundary of the publication DOM cases: the document data, snapshot
 * and change hook the real draft/publication controllers read. It holds no
 * draft, publication or schedule rule; BlockNote is the browser surface this
 * layer deliberately does not mount.
 */

export function envelopeOf(document: Document): Envelope {
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

export type EditorBoundary = {
  readonly model: DocumentModel
  /** One content transaction, as BlockNote would deliver to `onChange`. */
  readonly emitContentChange: () => void
}

type ChangeListener = (editor: unknown, transaction: unknown) => void

export function useEditorBoundary(initial: OpenDocument): EditorBoundary {
  const [fields, setFields] = useState(() => envelopeOf(initial.document))
  const fieldsRef = useRef(fields)
  const nodeItems = useMemo(() => nodes(initial.document), [initial.document])
  const snapshot = useCallback(async (): Promise<Document> => await Promise.resolve(
    validateDocument({ ...fieldsRef.current, blocks: initial.document.blocks }),
  ), [initial.document])
  const updateFields = useCallback((patch: Partial<Envelope>) => {
    // Production updates the ref before the state so a save started by the same
    // interaction snapshots the edit it just made.
    fieldsRef.current = { ...fieldsRef.current, ...patch }
    setFields(fieldsRef.current)
  }, [])
  const composingRef = useRef(false)
  const listenersRef = useRef(new Set<ChangeListener>())
  const editor = useMemo(() => {
    const boundary = {
      onChange: (listener: ChangeListener) => {
        listenersRef.current.add(listener)
        return () => {
          listenersRef.current.delete(listener)
        }
      },
    }
    // eslint-disable-next-line ts/no-unsafe-type-assertion -- jsdom mounts no BlockNote editor.
    return boundary as unknown as DocumentModel['editor']
  }, [])
  const emitContentChange = useCallback(() => {
    const transaction = { getChanges: () => [
      {},
    ] }
    for (const listener of listenersRef.current) {
      listener(editor, transaction)
    }
  }, [editor])
  return {
    model: {
      editor,
      envelope: fields,
      nodeItems,
      snapshot,
      composingRef,
      editorLocale: 'en',
      pasteNotice: '',
      uploadFiles: async () => await Promise.resolve(''),
      uploading: false,
      hasUploads: () => false,
      waitUploads: async () => await Promise.resolve(),
      pastePlain: null,
      updateFields,
    },
    emitContentChange,
  }
}
