/* eslint-disable style/max-len -- Verbatim case references stay on one line. */
/**
 * Where the migrated standalone history browser assertions now live.
 *
 * Each entry names one E2E case by `file :: title` and the component browser case
 * that replaced it, plus the original assertions the replacement proves. The
 * component cases mount the unmodified `HistoryPage`: the harness supplies the
 * props the server route would (mount data through the real client, the locale
 * and the session token) and every other response comes from the case's own HTTP
 * handler table. No controller, client, schema, stylesheet or translation is
 * substituted.
 *
 * `retained` names cases that stay in the real E2E suite and why only the built
 * application can prove them.
 */
export type HistoryMigration = {
  readonly legacy: string
  readonly component: string
  /** Original assertions the component case proves. */
  readonly proves: readonly string[]
}

export type RetainedHistory = {
  readonly cases: readonly string[]
  readonly reason: string
}

const e2e = 'tests/browser/history/history-boundaries.spec.ts'
const page = 'tests/browser/history/history.spec.ts'
const interleaving = 'tests/browser/history/history-interleaving.spec.ts'
const conflict = 'tests/components/specs/history-conflict.spec.ts'
const requirements = 'tests/components/specs/history-requirements.spec.ts'
const mutations = 'tests/integration/history-mutations.integration.ts'
const outcomes = 'tests/dom/history-state-outcomes.test.tsx'
const selection = 'tests/dom/history-state-selection.test.tsx'
const reconcile = 'tests/dom/history-state-reconciliation.test.tsx'

function c(file: string, title: string): string {
  return `${file} :: ${title}`
}

export const historyMigrations: readonly HistoryMigration[] = [
  {
    legacy: c(e2e, 'history explains unpublished revision requirements in en'),
    component: c(requirements, 'history explains unpublished revision requirements in en'),
    proves: [
      'the requirements stay inside the viewport at 1440px',
      'the created revision, the disabled publish and the removed reasons moved to tests/dom/history-state-selection.test.tsx :: lists why the chosen revision cannot be published in en',
    ],
  },
  {
    legacy: c(e2e, 'history explains unpublished revision requirements in zh'),
    component: c(requirements, 'history explains unpublished revision requirements in zh'),
    proves: [
      'the Chinese requirements stay inside the viewport at 390px, where the selection Select replaces the sidebar',
      'the Chinese copy, the disabled publish and the removed reasons moved to tests/dom/history-state-selection.test.tsx :: lists why the chosen revision cannot be published in zh-CN',
    ],
  },
  {
    legacy: c(page, 'history CAS conflict refreshes the baseline and preserves the selected revision for explicit retry'),
    component: c(conflict, 'history CAS conflict refreshes the baseline and preserves the selected revision for explicit retry'),
    proves: [
      'opening the comparison list marks the chosen option aria-selected, and Escape returns focus to the trigger',
      'the conflict notice, the preserved selection, the refreshed baseline and the single refused write moved to tests/dom/history-state-selection.test.tsx :: adopts the refreshed baseline without a manual refresh after a conflict',
    ],
  },
]

export type HistoryServerProof = {
  /** The browser or jsdom case whose server answer is a fixture. */
  readonly component: string
  readonly integration: readonly string[]
  readonly proves: readonly string[]
}

/**
 * Server guarantees behind the cases that answer their own writes.
 *
 * A fixture can return whatever the case wants, so the persisted version, head,
 * live revision and the conflict guard are proved once against the Worker and real
 * D1 instead of being inferred from the rendered notice. The `component` fields now
 * name the jsdom cases that took over the fixture replies; the integration cases
 * below are the obligation and do not move with the browser layer.
 */
export const historyServerProofs: readonly HistoryServerProof[] = [
  {
    component: c(selection, 'adopts the refreshed baseline without a manual refresh after a conflict'),
    integration: [
      c(mutations, 'a stale restore is refused and leaves the racing save as head'),
    ],
    proves: [
      'a restore carrying the version the page held before another tab saved is 409 EDIT_CONFLICT',
      'the persisted head, live revision and version stay as the racing save left them, with no extra revision',
    ],
  },
  {
    component: c(outcomes, 'keeps the confirmed publish and the new live generation when the following read is refused'),
    integration: [
      c(mutations, 'publishing a selected historical revision advances the persisted version exactly once'),
    ],
    proves: [
      'publishing a selected historical revision stores version = the previous version + 1 exactly',
      'the head stays, the selected revision becomes live, and one publication event is recorded',
    ],
  },
  {
    component: c(reconcile, 'reconciles nine unconfirmed restores and writes each round with its own key'),
    integration: [
      c(mutations, 'nine sequential restores commit one revision each and replay idempotently'),
    ],
    proves: [
      'each of the nine restores commits exactly one revision and advances the version by exactly one',
      'each restore leaves the selected revision\'s document as the head and the live revision untouched',
      'replaying the last request with its own key returns the same acknowledgement and adds no revision',
    ],
  },
]

export const retainedHistoryCases: readonly RetainedHistory[] = [
  {
    cases: [
      c(page, 'history compares stable blocks, restores a new head and publishes a selected historical revision'),
    ],
    reason: 'One workflow asserts the stored head, the live revision and the published reader routes (/posts/<slug> gone, /posts/<slug>-updated readable), which need real D1 and the server-rendered reader.',
  },
  {
    cases: [
      c(interleaving, 'two destination pops before restoration preserve the latest Back destination'),
      c(interleaving, 'Stay here during a second restoration cancels that traversal before its repair arrives'),
      c(interleaving, 'a delayed approved traversal cannot displace a newer clean browser destination'),
      c(interleaving, 'legacy history restores, cancels and saves an ordinary Back traversal'),
      c(interleaving, 'returning to the source during restoration dismisses the pending departure'),
      c(interleaving, 'a history request supersedes an earlier internal link before restoration completes'),
      c(interleaving, 'a branch write drains its rejected repair and later history still works'),
    ],
    reason: 'The subject is native browser history and the editor before-leave guard: traversal, repairs and document saves only exist in a live page with the editor. These seven keys were one file-level entry until it was named per registered case; the expansion adds no coverage and removes none.',
  },
]
