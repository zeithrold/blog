/* eslint-disable style/max-len -- Verbatim case references stay on one line. */
/**
 * The guard tail: where the mobile-cancellation, departure and comparison
 * semantics go.
 *
 * Independent of `history-retirements.ts`, the batch ledger that is already merged,
 * so this tail lands without touching it. Each row names the Playwright case as
 * registered, the jsdom cases that prove the same state with the real hooks, guard
 * decision logic and departure policy, and the assertions only a browser can
 * deliver.
 */

export type GuardRetirement = {
  /** The Playwright case as registered today: `file :: title`. */
  readonly playwright: string
  /** jsdom cases that prove the state those assertions describe. */
  readonly dom: readonly string[]
  /** Assertions the jsdom cases prove. */
  readonly proves: readonly string[]
  /** Assertions that survive only in a real browser. */
  readonly remainsBrowser: readonly string[]
}

const focus = 'tests/browser/history/editor-history-focus.spec.ts'
const compare = 'tests/browser/history/history.spec.ts'
const guard = 'tests/dom/history-guard-state.test.tsx'
const comparison = 'tests/dom/history-comparison-state.test.tsx'
const selection = 'tests/dom/history-state-selection.test.tsx'
const departure = 'tests/dom/history-departure-policy.test.tsx'

function at(file: string, title: string): string {
  return `${file} :: ${title}`
}

export const guardRetirements: readonly GuardRetirement[] = [
  {
    playwright: at(focus, 'mobile cancellation returns to the menu trigger'),
    dom: [
      at(guard, 'hands the context the guard the caller registers and clears it when unregistered'),
      at(guard, 'exposes the context cancel and the registration cancel a refusal runs'),
    ],
    proves: [
      'the context holds exactly the guard the caller registered, and the caller\'s own flag decides whether one is held',
      'the guard context and registration each expose their cancellation callback, and the resolver stays available afterwards',
    ],
    remainsBrowser: [
      'the mobile drawer and its Tags menuitem start the in-app navigation: that is `next/link` onNavigate interception, and the host adapter has no onNavigate, so it cannot stand in for it',
      'focus returns to the .workspace-navigation-mobile trigger (native focus delivery and painted layout)',
    ],
  },
  {
    playwright: at(focus, 'mobile cancellation returns to the edited title'),
    dom: [
      at(guard, 'requests the chosen target, stays when it is refused and moves when it is approved'),
    ],
    proves: [
      'an external traversal asks the guard with the destination href and returns handled to its driver',
      'a pop the driver reports as its own repair completes the repair instead of asking again (jsdom supplies that marker; the browser driver derives it from the Navigation API)',
      'refusing voids the pending approval, so a late commit moves nothing',
      'an approved departure moves to the target the reader chose',
    ],
    remainsBrowser: [
      'history.back() delivery in a real browser session',
      'focus returns to the edited title field (native focus delivery)',
    ],
  },
  {
    // The departure policy those two cases also assert from the browser: the
    // saving dialog, and the way back out of it.
    playwright: at(focus, 'mobile cancellation returns to the menu trigger'),
    dom: [
      at(departure, 'asks an editor with unsaved work before it leaves, and stays when the reader stays'),
      at(departure, 'asks an editor that is still uploading, and hands nothing over when the reader stays'),
      at(departure, 'lets an idle editor leave without a dialog or a packet'),
    ],
    proves: [
      'an editor holding unsaved work opens the saving dialog instead of leaving: the real dialog over the real source and controller, busy while the held save is in flight',
      'the dialog reports that held save, and its own "Stay here" returns the departure to idle and hands the host router nothing — before and after the save it held lands — with no dialog, no local-recovery copy and no unsaved work left behind',
      'the next departure after that refusal is an idle one: exactly one call to the host router, with the target the reader chose, and no second packet',
      'an editor that is still uploading is asked too, and staying hands nothing over; crossing the policy\'s own 40ms wait after the upload completes resumes that continuation, which then finds the refusal: no dialog, no packet and no call',
      'an idle editor hands the host router exactly one call, with the reader\'s target, and sends no packet',
    ],
    remainsBrowser: [
      '`next/link` onNavigate interception starting the in-app navigation: the host adapter has no onNavigate, so a jsdom case dispatches the guard registration the shell calls with the same target',
      'native back (`history.back()`) and the Navigation API marker the browser driver derives',
      'focus hand-back to the drawer trigger or the edited title field',
      'delivery after the host router\'s call: the adapter runs the real `assign`, and jsdom implements no document navigation, so the route, its server render and its history entry stay browser facts',
    ],
  },
  {
    // The browser journey's lines 9-20 only: the comparison semantics. The stored
    // head/live/reader assertions of that case stay in the batch ledger.
    playwright: at(compare, 'history compares stable blocks, restores a new head and publishes a selected historical revision'),
    dom: [
      at(comparison, 'reports no differences when the baseline is the selected revision'),
      at(selection, 'classifies a block that changed between the two compared revisions in en'),
    ],
    proves: [
      'choosing the selected revision as the baseline removes every difference row and says the revisions contain the same content',
      'two stored revisions that share a block id show one changed block with its before and after text',
    ],
    remainsBrowser: [
      'opening the compare listbox and choosing options with a pointer',
      'the stored head, live revision, version and the published reader routes need real D1 and the server-rendered reader',
    ],
  },
]
