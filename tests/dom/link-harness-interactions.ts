import type { ApiService } from './http'
import type { MountedLinkEditor } from './link-harness'
import { TextSelection } from 'prosemirror-state'
import { act } from 'react'
import { until } from './environment'
import { editorBody } from './link-harness'

type PendingFocusAutoFocus = {
  readonly target: EventTarget
  readonly event: Event
  readonly removals: (() => void)[]
}

type FocusCloseState = {
  readonly selector: string
  readonly pending: PendingFocusAutoFocus[]
  readonly observedTargets: string[]
  readonly originalDispatch: typeof EventTarget.prototype.dispatchEvent
  readonly originalRemove: typeof EventTarget.prototype.removeEventListener
  readonly capture: () => void
  active: boolean
}

function dispatchFocusAutoFocus(
  state: FocusCloseState,
  target: EventTarget,
  event: Event,
): boolean {
  if (event.type === 'focusScope.autoFocusOnUnmount' && target instanceof HTMLElement) {
    const className = target.className.toString()
    state.observedTargets.push(className.length === 0 ? target.tagName : className)
  }
  if (state.active && event.type === 'focusScope.autoFocusOnUnmount' && target instanceof HTMLElement
    && (target.matches(state.selector) || target.closest(state.selector) !== null)) {
    event.preventDefault()
    state.pending.push({
      target,
      event,
      removals: [],
    })
    state.capture()
    return true
  }
  return Boolean(Reflect.apply(state.originalDispatch, target, [event]))
}

function removeFocusAutoFocusListener(
  {
    state,
    target,
    type,
    listener,
    options,
  }: {
    readonly state: FocusCloseState
    readonly target: EventTarget
    readonly type: string
    readonly listener: EventListenerOrEventListenerObject | null
    readonly options?: boolean | EventListenerOptions
  },
): void {
  const held = type === 'focusScope.autoFocusOnUnmount'
    ? state.pending.findLast(entry => entry.target === target)
    : undefined
  const remove = (): void => {
    Reflect.apply(state.originalRemove, target, [
      type,
      listener,
      options,
    ])
  }
  if (held !== undefined) {
    held.removals.push(remove)
    return
  }
  remove()
}

function releaseFocusAutoFocus(state: FocusCloseState): void {
  if (!state.active) {
    return
  }
  state.active = false
  EventTarget.prototype.dispatchEvent = state.originalDispatch
  EventTarget.prototype.removeEventListener = state.originalRemove
  for (const entry of state.pending.splice(0)) {
    Reflect.apply(state.originalDispatch, entry.target, [entry.event])
    for (const remove of entry.removals) {
      remove()
    }
  }
}

/** Positions the actual editor selection and DOM range that the production controls observe. */
export async function selectLinkText(
  view: MountedLinkEditor,
  range: { readonly start: number, readonly end: number },
): Promise<void> {
  const body = editorBody(view)
  const inline = body.querySelector<HTMLElement>('.bn-inline-content')
  if (inline === null) {
    throw new Error('The link fixture has no inline paragraph')
  }
  const textPoint = (offset: number): { readonly node: Node, readonly offset: number } => {
    const walker = document.createTreeWalker(inline, NodeFilter.SHOW_TEXT)
    let node = walker.nextNode()
    let remaining = offset
    while (node !== null) {
      const length = node.textContent?.length ?? 0
      if (remaining <= length) {
        return { node, offset: remaining }
      }
      remaining -= length
      node = walker.nextNode()
    }
    throw new Error('The requested link range exceeds the rendered paragraph')
  }
  const start = textPoint(range.start)
  const end = textPoint(range.end)
  const from = view.editor.prosemirrorView.posAtDOM(start.node, start.offset, 1)
  const to = view.editor.prosemirrorView.posAtDOM(end.node, end.offset, -1)
  try {
    await act(async () => {
      body.focus()
      view.editor.prosemirrorView.dispatch(
        view.editor.prosemirrorView.state.tr.setSelection(
          TextSelection.create(view.editor.prosemirrorView.state.doc, from, to),
        ),
      )
      window.getSelection()?.setBaseAndExtent(start.node, start.offset, end.node, end.offset)
      document.dispatchEvent(new Event('selectionchange'))
      await until(() => {
        const selection = view.editor.prosemirrorState.selection
        return selection.from === from && selection.to === to
      })
    })
  }
  catch {
    const selection = view.editor.prosemirrorState.selection
    throw new Error(
      `Could not select the link range ${from}-${to}; editor=${selection.from}-${selection.to}; `
      + `DOM=${window.getSelection()?.toString() ?? ''}`,
    )
  }
}

/** Reads the production ProseMirror view for an in-test document transaction. */
export function proseMirrorView(view: MountedLinkEditor): typeof view.editor.prosemirrorView {
  return view.editor.prosemirrorView
}

/** Dispatches the real editor's online flush and waits for its declared requests. */
export async function flushDraft(view: MountedLinkEditor): Promise<void> {
  await act(async () => {
    window.dispatchEvent(new Event('online'))
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0)
    })
    await view.api.expectServed()
  })
}

export function revisionWrites(view: MountedLinkEditor): ApiService['calls'][number][] {
  return view.api.calls.filter(call => call.method === 'PUT')
}

/** Defers Radix's close-focus event while leaving the real overlay lifecycle mounted. */
export function deferFocusScopeClose(selector: string): {
  count: () => number
  captured: Promise<void>
  observedTargets: () => readonly string[]
  release: () => void
} {
  // eslint-disable-next-line ts/unbound-method -- The native method is invoked with each event target below.
  const originalDispatch = EventTarget.prototype.dispatchEvent
  // eslint-disable-next-line ts/unbound-method -- The native method is invoked with each event target below.
  const originalRemove = EventTarget.prototype.removeEventListener
  let capture: () => void = () => {}
  const captured = new Promise<void>((resolve) => {
    capture = resolve
  })
  const state: FocusCloseState = {
    selector,
    pending: [],
    observedTargets: [],
    originalDispatch,
    originalRemove,
    capture,
    active: true,
  }
  EventTarget.prototype.dispatchEvent = function (this: EventTarget, event): boolean {
    return dispatchFocusAutoFocus(state, this, event)
  }
  EventTarget.prototype.removeEventListener = function (
    this: EventTarget,
    type,
    listener,
    options,
  ): void {
    removeFocusAutoFocusListener({
      state,
      target: this,
      type,
      listener,
      options,
    })
  }
  return {
    count: () => state.pending.length,
    captured,
    observedTargets: () => state.observedTargets,
    release: () => releaseFocusAutoFocus(state),
  }
}
