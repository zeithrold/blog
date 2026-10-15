import type { Document } from '@/content/document'
import type { DocumentModel } from '@/features/editor/core/model'
import { useEffect, useState } from 'react'

type Preview = {
  document: Document | null
  error: string
}

export function usePreview(model: DocumentModel, open: boolean): Preview {
  const [document, setDocument] = useState<Document | null>(null)
  const [error, setError] = useState('')
  const { editor, snapshot, composingRef, envelope } = model
  useEffect(() => {
    if (!open) {
      return
    }
    let active = true
    let sequence = 0
    let idle: ReturnType<typeof setTimeout> | undefined
    let deadline: ReturnType<typeof setTimeout> | undefined
    const render = (): void => {
      if (composingRef.current) {
        idle = setTimeout(render, 100)
        return
      }
      clearTimeout(idle)
      clearTimeout(deadline)
      deadline = undefined
      const current = ++sequence
      void snapshot()
        .then((value) => {
          if (active && current === sequence) {
            setDocument(value)
            setError('')
          }
        })
        .catch(() => {
          if (active && current === sequence) {
            setError('Complete required fields to preview this draft.')
          }
        })
    }
    const change = (): void => {
      sequence++
      clearTimeout(idle)
      idle = setTimeout(render, 100)
      deadline ??= setTimeout(render, 500)
    }
    render()
    const stop = editor.onChange(change)
    return () => {
      active = false
      sequence++
      stop()
      clearTimeout(idle)
      clearTimeout(deadline)
    }
  }, [
    open,
    editor,
    snapshot,
    composingRef,
    envelope,
  ])
  return { document, error }
}
