/*
 * Publication-specific queries over the shared DOM layer. The primitives live in
 * `environment.ts` (the jsdom host) and `dom.ts` (queries and interactions), so
 * the whole layer has one harness; this file adds only the two badges this domain
 * reads and re-exports the rest, keeping this pilot's existing imports intact.
 */

export {
  all,
  button,
  click,
  combobox,
  containing,
  field,
  one,
  openCombobox,
  option,
  press,
  selectNative,
  text,
  texts,
  typeText,
} from './dom'
export {
  advance,
  drainHostTask,
  installBrowserShims,
  setMediaState,
  until,
} from './environment'

/** The pending-plan badge the real ScheduledStatus renders. */
export function scheduledBadge(container: ParentNode): boolean {
  return Array.from(container.querySelectorAll('[data-slot="badge"][title]'))
    .some(badge => badge.textContent.trim() === 'Scheduled')
}

export function cancelControls(container: ParentNode): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll('button'))
    .filter(element => element.textContent.trim() === 'Cancel schedule')
}
