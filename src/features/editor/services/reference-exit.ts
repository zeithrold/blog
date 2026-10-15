import type { RefObject } from 'react'
import type { Reference } from '@/features/editor/services/reference-form'
import { useCallback, useEffect, useState } from 'react'
import { useAuthorPage } from '@/features/editor/services/reference-author-page'
import { useReferenceForm } from '@/features/editor/services/reference-form'
import { useReferencePage } from '@/features/editor/services/reference-page'

export type ReferenceEditorProps = {
  reference: Reference
  creating: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  save: (reference: Reference) => void
  returnFocus: () => HTMLButtonElement | null
}
export function useReferenceEditor(props: ReferenceEditorProps, editorRef: RefObject<HTMLDivElement | null>): {
  author: ReturnType<typeof useAuthorPage>
  model: ReturnType<typeof useReferenceForm>
  page: ReturnType<typeof useReferencePage>
  confirming: boolean
  close: () => void
  finish: () => void
  keep: () => void
} {
  const { onOpenChange, returnFocus } = props
  const page = useReferencePage()
  const finish = useCallback((): void => {
    onOpenChange(false)
    page?.leave()
    requestAnimationFrame(() => returnFocus()?.focus({ preventScroll: true }))
  }, [
    onOpenChange,
    returnFocus,
    page,
  ])
  const model = useReferenceForm(props.reference, props.open, (reference) => {
    props.save(reference)
    finish()
  })
  const author = useAuthorPage(model.authors, editorRef)
  const { confirming, close: closeReference, keep } = useReferenceExit(model.dirty, finish, editorRef)
  const close = author.session === null ? closeReference : author.close
  useEffect(() => {
    if (props.open && page !== null) {
      page.registerClose(close)
      return () => page.registerClose(null)
    }
    return undefined
  }, [
    props.open,
    page,
    close,
  ])
  useReferenceFocus(props.open, props.creating, page?.outlet, editorRef)
  return { author, model, page, confirming, close, finish, keep }
}

function useReferenceFocus(
  open: boolean,
  creating: boolean,
  outlet: HTMLDivElement | null | undefined,
  editorRef: RefObject<HTMLDivElement | null>,
): void {
  useEffect(() => {
    if (open && outlet !== null && outlet !== undefined) {
      const frame = requestAnimationFrame(() => editorRef.current
        ?.querySelector<HTMLInputElement>(`input[name="${creating ? 'doi' : 'title'}"]`)
        ?.focus())
      return () => cancelAnimationFrame(frame)
    }
    return undefined
  }, [
    open,
    creating,
    outlet,
    editorRef,
  ])
}

function useReferenceExit(dirty: boolean, finish: () => void, editorRef: RefObject<HTMLDivElement | null>): {
  confirming: boolean
  close: () => void
  keep: () => void
} {
  const [confirming, setConfirming] = useState(false)
  const keep = useCallback((): void => {
    setConfirming(false)
    focusReferenceEditor(editorRef, 'input[name="title"]')
  }, [editorRef])
  const close = useCallback((): void => {
    if (confirming) {
      keep()
    }
    else if (dirty) {
      setConfirming(true)
      focusReferenceEditor(editorRef, '[data-reference-keep]')
    }
    else {
      finish()
    }
  }, [
    confirming,
    dirty,
    finish,
    keep,
    editorRef,
  ])
  return { confirming, close, keep }
}
function focusReferenceEditor(editorRef: RefObject<HTMLDivElement | null>, selector: string): void {
  requestAnimationFrame(() => editorRef.current?.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true }))
}
