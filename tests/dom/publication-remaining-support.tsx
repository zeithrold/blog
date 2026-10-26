import type { MountedPublication } from './publication-support'
import { act } from 'react'

export {
  all,
  button,
  click,
  combobox,
  field,
  one,
  openCombobox,
  option,
  press,
  text,
  texts,
  typeText,
} from './dom'
export {
  advance,
  drainHostTask,
  until,
} from './environment'
export {
  acceptSave,
  deferred,
  failure,
  incompleteDocument,
  publicationDocument,
  publicationSchedule,
  publicationServer,
  savedAhead,
} from './publication-stub'
export {
  cancelControls,
  mountPublication,
  resetDomPilot,
  scheduledBadge,
} from './publication-support'
export type { MountedPublication } from './publication-support'

/**
 * Provides a synthetic editor-data input for controller-boundary tests. It is
 * not the product Title field and cannot prove that field's onChange wiring.
 */
export function attachTitleInput(view: MountedPublication): HTMLInputElement {
  const input = document.createElement('input')
  input.setAttribute('aria-label', 'Test title input')
  input.value = view.state().workspace.model.envelope.meta.title
  input.addEventListener('input', () => {
    view.editTitle(input.value)
  })
  view.container.prepend(input)
  return input
}

/** Dispatches one real click and waits for tasks started by that UI control. */
export async function clickAndSettle(view: MountedPublication, element: Element): Promise<void> {
  await act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await view.settle()
  })
}
