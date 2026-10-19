import type { PointerEvent, RefObject } from 'react'
import type { AuthorDraft } from '@/features/editor/references/reference-authors-model'
import { useRef, useState } from 'react'

type Gesture = { id: string, over: string, start: number, moved: boolean }
export function useAuthorSort(
  rows: AuthorDraft[],
  root: RefObject<HTMLElement | null>,
  move: (from: number, to: number) => void,
): {
  active: string | undefined
  over: string | undefined
  start: (event: PointerEvent<HTMLButtonElement>, id: string) => void
  track: (event: PointerEvent<HTMLButtonElement>) => void
  finish: () => void
  cancel: () => void
} {
  const gestureRef = useRef<Gesture | null>(null)
  const [preview, setPreview] = useState<Gesture | null>(null)
  const cancel = (): void => {
    gestureRef.current = null
    setPreview(null)
  }
  const start = (event: PointerEvent<HTMLButtonElement>, id: string): void => {
    if (event.button !== 0 || !event.isPrimary) {
      return
    }
    event.preventDefault()
    event.currentTarget.focus({ preventScroll: true })
    event.currentTarget.setPointerCapture(event.pointerId)
    gestureRef.current = { id, over: id, start: event.clientY, moved: false }
    setPreview(gestureRef.current)
  }
  const track = (event: PointerEvent<HTMLButtonElement>): void => {
    const gesture = gestureRef.current
    if (gesture === null || root.current === null) {
      return
    }
    scrollAuthors(root.current, event.clientY)
    const over = closestAuthor(root.current, event.clientY) ?? gesture.over
    const next = { ...gesture, over, moved: gesture.moved || Math.abs(event.clientY - gesture.start) > 4 }
    gestureRef.current = next
    setPreview(next)
  }
  const finish = (): void => {
    const gesture = gestureRef.current
    if (gesture?.moved === true) {
      move(rows.findIndex(row => row.id === gesture.id), rows.findIndex(row => row.id === gesture.over))
    }
    cancel()
  }
  return { active: preview?.id, over: preview?.over, start, track, finish, cancel }
}
function closestAuthor(root: HTMLElement, y: number): string | undefined {
  let distance = Number.POSITIVE_INFINITY
  let id: string | undefined
  for (const row of root.querySelectorAll<HTMLElement>('[data-author-row]')) {
    const rect = row.getBoundingClientRect()
    const next = Math.abs(y - (rect.top + rect.height / 2))
    if (next < distance) {
      distance = next
      id = row.dataset.authorRow
    }
  }
  return id
}
function scrollAuthors(root: HTMLElement, y: number): void {
  const scroll = root.closest<HTMLElement>('[data-slot="reference-form-scroll"]')
  if (scroll === null) {
    return
  }
  const bounds = scroll.getBoundingClientRect()
  if (y < bounds.top + 32) {
    scroll.scrollTop -= 16
  }
  else if (y > bounds.bottom - 32) {
    scroll.scrollTop += 16
  }
}
