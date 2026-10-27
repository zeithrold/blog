import type { ReactElement } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

/**
 * A bare jsdom mount for the navigation-guard hooks and state machines.
 *
 * These subjects import no host routing module, so this helper needs no adapter:
 * the real hooks, contexts and `HistoryNavigation` run, and the browser history
 * API is the case's own driver object where it is needed.
 */

export type GuardView = {
  readonly container: HTMLElement
  readonly render: (element: ReactElement) => void
  readonly unmount: () => void
}

const mounted: GuardView[] = []

export function mount(element: ReactElement): GuardView {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const view: GuardView = {
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

/** Unmounts every guard surface this file mounted. */
export function resetGuardDom(): void {
  for (const view of mounted.splice(0)) {
    view.unmount()
  }
}
