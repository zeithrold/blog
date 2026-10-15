import type { Dispatch, SetStateAction } from 'react'
import type { ReferenceDraft } from '@/features/editor/services/reference-form'

export type AuthorDraft = { id: string, name: string }
export function authorNames(value: string): string[] {
  return value.split(/\r\n?|\n/u).map(name => name.trim()).filter(Boolean)
}
export function authorDrafts(names: string[]): AuthorDraft[] {
  return names.map(name => ({ id: crypto.randomUUID(), name }))
}
export function moveAuthor(rows: AuthorDraft[], from: number, to: number): AuthorDraft[] {
  if (from === to || from < 0 || to < 0 || from >= rows.length || to >= rows.length) {
    return rows
  }
  const next = [
    ...rows,
  ]
  const row = next.splice(from, 1)[0]
  if (row !== undefined) {
    next.splice(to, 0, row)
  }
  return next
}
export function referenceAuthorControls(
  draft: ReferenceDraft,
  setDraft: Dispatch<SetStateAction<ReferenceDraft>>,
  clearError: () => void,
): {
  rows: AuthorDraft[]
  save: (id: string | null, value: string) => void
  remove: (id: string) => void
  move: (from: number, to: number) => void
} {
  const update = (transform: (rows: AuthorDraft[]) => AuthorDraft[]): void => {
    setDraft(current => ({ ...current, authors: transform(current.authors) }))
    clearError()
  }
  return {
    rows: draft.authors,
    save: (id, value) => update(rows => id === null
      ? [
          ...rows,
          ...authorDrafts(authorNames(value)),
        ]
      : rows.flatMap(row => row.id === id
          ? authorNames(value).map((name, index) => ({ id: index === 0 ? id : crypto.randomUUID(), name }))
          : [row])),
    remove: id => update(rows => rows.filter(row => row.id !== id)),
    move: (from, to) => update(rows => moveAuthor(rows, from, to)),
  }
}
