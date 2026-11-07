'use client'
import type { DeparturePermit, EditorDeparture } from '@/features/editor/workspace/editor-departure'
import type {
  DepartureQueue,
  DepartureWorkspace,
  EditorDepartureSource,
} from '@/features/editor/workspace/editor-departure-source'
import { createContext, use, useLayoutEffect } from 'react'

/** What the editor route's boundary publishes to the editor document it wraps. */
export type EditorDepartureBoundary = {
  source: EditorDepartureSource
  controller: EditorDeparture
  permit: DeparturePermit
}

export const EditorDepartureContext = createContext<EditorDepartureBoundary | null>(null)

/** Attaches the loaded workspace and its upload queue to the route's departure policy. */
export function useEditorDepartureAttachment(workspace: DepartureWorkspace, queue: DepartureQueue): void {
  const departure = use(EditorDepartureContext)
  useLayoutEffect(() => {
    departure?.source.attach(workspace, queue)
    return () => departure?.source.detach()
  }, [
    departure,
    workspace,
    queue,
  ])
}

/**
 * The permit for the one departure this boundary approved, or `null` outside the
 * editor. The editor's unload guards warn unless that departure is approved.
 */
export function useEditorDeparturePermit(): DeparturePermit | null {
  return use(EditorDepartureContext)?.permit ?? null
}
