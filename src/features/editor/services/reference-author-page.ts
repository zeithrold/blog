import type { RefObject } from 'react'
import type { AuthorDraft, referenceAuthorControls } from '@/features/editor/services/reference-authors'
import { useState } from 'react'
import { authorNames } from '@/features/editor/services/reference-authors'

type Session = { id: string | null, original: string, value: string, confirming: boolean, invalid: boolean }
export function useAuthorPage(
  authors: ReturnType<typeof referenceAuthorControls>,
  editorRef: RefObject<HTMLDivElement | null>,
): {
  session: Session | null
  edit: (row?: AuthorDraft) => void
  change: (value: string) => void
  close: () => void
  finish: () => void
  keep: () => void
  submit: () => void
} {
  const [session, setSession] = useState<Session | null>(null)
  const focus = (selector: string): void => {
    requestAnimationFrame(() => editorRef.current?.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true }))
  }
  const finish = (): void => {
    setSession(null)
    focus(session === null || session.id === null ? '[data-author-add]' : `[data-author-id="${session.id}"]`)
  }
  const keep = (): void => {
    setSession(current => current === null ? null : { ...current, confirming: false })
    focus('[data-author-input]')
  }
  return {
    session,
    edit: (row) => {
      const name = row?.name ?? ''
      setSession({ id: row?.id ?? null, original: name, value: name, confirming: false, invalid: false })
      focus('[data-author-input]')
    },
    change: value => setSession(current => current === null ? null : { ...current, value, invalid: false }),
    close: () => closeAuthorPage(session, setSession, { finish, keep, focus }),
    finish,
    keep,
    submit: () => {
      if (session === null) {
        return
      }
      const names = authorNames(session.value)
      const total = authors.rows.length + names.length - (session.id === null ? 0 : 1)
      if (names.length === 0 || total > 50 || names.some(name => name.length > 200)) {
        setSession({ ...session, invalid: true })
        focus('[data-author-input]')
        return
      }
      authors.save(session.id, session.value)
      finish()
    },
  }
}
function closeAuthorPage(
  session: Session | null,
  setSession: (session: Session) => void,
  actions: { finish: () => void, keep: () => void, focus: (selector: string) => void },
): void {
  if (session?.confirming === true) {
    actions.keep()
  }
  else if (session !== null && session.value !== session.original) {
    setSession({ ...session, confirming: true })
    actions.focus('[data-author-keep]')
  }
  else {
    actions.finish()
  }
}
