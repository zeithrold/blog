import type { Selection } from 'prosemirror-state'
import type { KeyboardEvent, MouseEvent, PointerEvent, RefObject } from 'react'
import type { ContextTarget } from '@/features/editor/controls/context-menu-target'
import type { Workspace } from '@/features/editor/workspace/editor-types'
import { ShowSelectionExtension } from '@blocknote/core/extensions'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  captureContextTarget,
  contextSelection,
  restoreContextTarget,
} from '@/features/editor/controls/context-menu-target'

const query = '(min-width: 701px) and (hover: hover) and (pointer: fine)'
const desktopSnapshot = (): boolean => matchMedia(query).matches
const serverSnapshot = (): boolean => false
function subscribeDesktop(listener: () => void): () => void {
  const media = matchMedia(query)
  media.addEventListener('change', listener)
  return () => media.removeEventListener('change', listener)
}

// Event-session memory is mutable; it must survive menu focus and closing renders.
type Memory = {
  previous: Selection | null
  keyboard: boolean
  closing: ContextTarget | null
  focus: boolean
  restore: boolean
}
type State = {
  readonly workspace: Workspace
  readonly enabled: boolean
  readonly target: ContextTarget | null
  readonly setTarget: (target: ContextTarget | null) => void
  readonly memoryRef: RefObject<Memory>
  readonly setComposing: (value: boolean) => void
  readonly setTouch: (value: boolean) => void
}

function useContextState(workspace: Workspace): State {
  const { editor } = workspace.model
  const desktop = useSyncExternalStore(subscribeDesktop, desktopSnapshot, serverSnapshot)
  const [composing, setComposing] = useState(false)
  const [touch, setTouch] = useState(false)
  const enabled = desktop && !touch && !composing && !workspace.busy && editor.isEditable
  const [session, setSession] = useState<{ enabled: boolean, target: ContextTarget | null }>({ enabled, target: null })
  const memoryRef = useRef<Memory>({ previous: null, keyboard: false, closing: null, focus: true, restore: true })
  if (session.enabled !== enabled) {
    setSession({ enabled, target: null })
  }
  const setTarget = useCallback((target: ContextTarget | null) => setSession(current => ({ ...current, target })), [])
  const { target } = session
  useEffect(() => editor.onChange(() => setTarget(null)), [editor, setTarget])
  useEffect(() => {
    const selection = editor.getExtension(ShowSelectionExtension)
    selection?.showSelection(enabled && target !== null, 'contextMenu')
    return () => selection?.showSelection(false, 'contextMenu')
  }, [
    editor,
    enabled,
    target,
  ])
  return { workspace, enabled, target, setTarget, memoryRef, setComposing, setTouch }
}

export function useEditorContextMenu(workspace: Workspace): EditorContextModel {
  const state = useContextState(workspace)
  const { enabled, target, setTarget, memoryRef, setComposing, setTouch } = state
  return {
    editor: workspace.model.editor,
    target,
    enabled,
    open: enabled && target !== null,
    run: action => runContext(state, action),
    setOpen: (open) => {
      if (!open) {
        setTarget(null)
      }
    },
    composition: (value) => {
      setComposing(value)
      setTarget(null)
    },
    remember: (event) => {
      setTouch(event.pointerType !== 'mouse')
      memoryRef.current.previous = event.button === 2 ? contextSelection(workspace.model.editor) : null
    },
    release: () => setTouch(false),
    prepare: (event: MouseEvent) => prepareContext(state, event),
    key: (event: KeyboardEvent) => openFromKeyboard(state, event),
    outside: () => { memoryRef.current.focus = false },
    close: event => closeContext(state, event),
    clipboard: event => clipboardContext(state, event),
  }
}

function runContext({ workspace, enabled, target, setTarget, memoryRef }: State, action: () => void): void {
  const { editor, composingRef } = workspace.model
  if (enabled && editor.isEditable && !composingRef.current && target !== null
    && restoreContextTarget(editor, target)) {
    memoryRef.current.restore = false
    editor.focus()
    action()
  }
  setTarget(null)
}

function closeContext({ workspace, enabled, memoryRef }: State, event: Event): void {
  event.preventDefault()
  const memory = memoryRef.current
  const saved = memory.closing
  memory.closing = null
  const { editor, composingRef } = workspace.model
  if (memory.focus && enabled && !composingRef.current && saved !== null) {
    if (memory.restore) {
      restoreContextTarget(editor, saved)
    }
    editor.focus()
  }
}

function clipboardContext({ workspace, target, setTarget }: State, event: KeyboardEvent): void {
  const { editor, plainPasteRef } = workspace.model
  if ((event.metaKey || event.ctrlKey) && [
    'c',
    'x',
    'v',
  ].includes(event.key.toLowerCase())
  && target !== null && restoreContextTarget(editor, target)) {
    editor.focus()
    plainPasteRef.current = event.key.toLowerCase() === 'v' && event.shiftKey
    setTarget(null)
  }
}

function prepareContext(state: State, event: MouseEvent): void {
  const { editor } = state.workspace.model
  const element = event.target
  if (!contextAllowed(state, event) || !(element instanceof Element)) {
    event.stopPropagation()
    return
  }
  const memory = state.memoryRef.current
  const captured = captureContextTarget(editor, {
    element,
    point: { left: event.clientX, top: event.clientY },
    previous: memory.previous ?? contextSelection(editor),
    keyboard: memory.keyboard,
  })
  memory.previous = null
  if (captured === null) {
    event.stopPropagation()
    return
  }
  memory.focus = true
  memory.restore = true
  memory.closing = captured
  state.setTarget(captured)
}

function openFromKeyboard(state: State, event: KeyboardEvent): void {
  const { editor, composingRef } = state.workspace.model
  if (!state.enabled || composingRef.current || event.nativeEvent.isComposing
    || !isContextKey(event) || isFormControl(event.target)) {
    return
  }
  event.preventDefault()
  const view = editor.prosemirrorView
  const bounds = view.coordsAtPos(view.state.selection.head)
  state.memoryRef.current.previous = contextSelection(editor)
  state.memoryRef.current.keyboard = true
  view.dom.dispatchEvent(new window.MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    button: 2,
    clientX: bounds.left,
    clientY: bounds.bottom,
  }))
  state.memoryRef.current.keyboard = false
}

function isFormControl(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('input,textarea,select,button') !== null
}

function contextAllowed(state: State, event: MouseEvent): boolean {
  const { editor, composingRef } = state.workspace.model
  return state.enabled && editor.isEditable && !composingRef.current && !editor.prosemirrorView.composing
    && !event.shiftKey && !event.defaultPrevented && event.target instanceof Element
    && editor.prosemirrorView.dom.contains(event.target) && !isFormControl(event.target)
}

function isContextKey(event: KeyboardEvent): boolean {
  return (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10'))
    && !event.ctrlKey && !event.metaKey && !event.altKey
}

export type EditorContextModel = {
  readonly editor: Workspace['model']['editor']
  readonly target: ContextTarget | null
  readonly enabled: boolean
  readonly open: boolean
  readonly run: (action: () => void) => void
  readonly setOpen: (open: boolean) => void
  readonly composition: (value: boolean) => void
  readonly remember: (event: PointerEvent) => void
  readonly release: () => void
  readonly prepare: (event: MouseEvent) => void
  readonly key: (event: KeyboardEvent) => void
  readonly outside: () => void
  readonly close: (event: Event) => void
  readonly clipboard: (event: KeyboardEvent) => void
}
