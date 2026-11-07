import type { ReactElement } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

/**
 * A bare jsdom mount for rendered components and the navigation-guard contexts.
 *
 * The subjects import no host routing module, so this helper needs no adapter:
 * real components, hooks and contexts run against jsdom's own DOM.
 */

export type MountedView = {
  readonly container: HTMLElement
  readonly render: (element: ReactElement) => void
  readonly unmount: () => void
}

const mounted: MountedView[] = []

export function mount(element: ReactElement): MountedView {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const view: MountedView = {
    container,
    render: (next) => {
      act(() => {
        root.render(next)
      })
    },
    unmount: () => {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
  view.render(element)
  mounted.push(view)
  return view
}

/** One event loop turn inside `act`, so registration effects and cleanups run. */
export async function settle(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0)
    })
  })
}

/** Unmounts every surface this file mounted. */
export function resetMounted(): void {
  for (const view of mounted.splice(0)) {
    view.unmount()
  }
}
