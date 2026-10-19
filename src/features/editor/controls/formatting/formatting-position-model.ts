import type { Store } from '@blocknote/core'
import type { GenericPopoverReference } from '@blocknote/react'
import type { DocumentModel } from '@/features/editor/workspace/document-model'
import { platform } from '@floating-ui/react'
import { posToDOMRect } from '@tiptap/core'

type Editor = DocumentModel['editor']

export function formattingPlatform(): typeof platform {
  let pending: Promise<void> | undefined
  return {
    ...platform,
    async getElementRects(args) {
      // Finish the current ResizeObserver delivery before position updates can
      // flush React layout. Share the frame, while measuring each call's args.
      pending ??= new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          pending = undefined
          resolve()
        })
      })
      await pending
      return await platform.getElementRects.call(this, args)
    },
  }
}

export function formattingReference(
  editor: Editor,
  dom: HTMLElement | undefined,
  isOpen: () => boolean,
): GenericPopoverReference {
  let last: DOMRect | undefined
  return {
    element: dom?.firstElementChild ?? undefined,
    getBoundingClientRect: () => {
      if (isOpen()) {
        const { from, to } = editor.prosemirrorState.selection
        last = posToDOMRect(editor.prosemirrorView, from, to)
      }
      // Preserve the final open position throughout the closing animation.
      return last ?? new DOMRect()
    },
  }
}

export function observeFormattingSelection(editor: Editor, store: Store<boolean>, update: () => void): () => void {
  let frame = 0
  const schedule = (): void => {
    if (frame === 0) {
      frame = requestAnimationFrame(() => {
        frame = 0
        update()
      })
    }
  }
  const stopSelection = editor.onSelectionChange(schedule)
  const stopChange = editor.onChange(schedule)
  const stopVisibility = store.subscribe(schedule)
  return () => {
    cancelAnimationFrame(frame)
    stopSelection()
    stopChange()
    stopVisibility()
  }
}

type Placement = 'bottom-start' | 'top-start' | 'top-end' | 'top'

export function formattingPlacement(table: boolean, alignment: string): Placement {
  if (table) {
    return 'bottom-start'
  }
  if (alignment === 'right') {
    return 'top-end'
  }
  return alignment === 'center' ? 'top' : 'top-start'
}
