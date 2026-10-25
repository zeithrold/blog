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
const bounds = 'tests/components/specs/history-boundaries.spec.ts'
const conflict = 'tests/components/specs/history-conflict.spec.ts'
const reconciliation = 'tests/components/specs/history-reconciliation.spec.ts'
const requirements = 'tests/components/specs/history-requirements.spec.ts'
const mutations = 'tests/integration/history-mutations.integration.ts'

function c(file: string, title: string): string {
  return `${file} :: ${title}`
}

export const historyMigrations: readonly HistoryMigration[] = [
  {
    legacy: c(e2e, 'history keeps confirmed restore success when history refresh fails'),
    component: c(bounds, 'history keeps confirmed restore success when history refresh fails'),
    proves: [
      'the confirmed restore still reports the created draft with the restored title',
      'the refused history read names itself and disables restore, publish and compare',
      'Refresh history clears the alert and re-enables compare',
      'the single write names the selected revision and the current version',
    ],
  },
  {
    legacy: c(e2e, 'history keeps confirmed publish success when history refresh fails'),
    component: c(bounds, 'history keeps confirmed publish success when history refresh fails'),
    proves: [
      'the confirmed publish still reports itself',
      'the refused document read locks restore, publish and compare with the refresh message',
      'Refresh history clears the alert and re-enables compare',
      'the single write carries the live generation and the selected revision',
    ],
  },
  {
    legacy: c(e2e, 'history retries an uncommitted disconnected operation with the same idempotency key'),
    component: c(bounds, 'history retries an uncommitted disconnected operation with the same idempotency key'),
    proves: [
      'the lost response reports an unconfirmed result instead of success',
      'Refresh history clears it without committing anything',
      'the retry repeats the same path, body and idempotency key',
      'the retry then reports the created draft',
    ],
  },
  {
    legacy: c(e2e, 'history explains a definite maintenance rejection without calling it an unknown result'),
    component: c(bounds, 'history explains a definite maintenance rejection without calling it an unknown result'),
    proves: [
      'the maintenance refusal keeps its own message',
      'it never reads as an unconfirmed result',
      'publish stays enabled for a later attempt',
    ],
  },
  {
    legacy: c(e2e, 'history keeps a conflict readable when loading the new baseline fails'),
    component: c(bounds, 'history keeps a conflict readable when loading the new baseline fails'),
    proves: [
      'the conflict notice survives a refused baseline read',
      'the alert names the required refresh and locks restore',
      'after Refresh history the baseline is the newer revision and restore unlocks',
    ],
  },
  {
    legacy: c(e2e, 'a new failed history operation clears the previous success notice'),
    component: c(bounds, 'a new failed history operation clears the previous success notice'),
    proves: [
      'a confirmed restore shows its status',
      'a following refused restore shows the owner error',
      'the older success notice is gone',
    ],
  },
  {
    legacy: c(e2e, 'history displays actionable reasons returned by the publication API'),
    component: c(bounds, 'history displays actionable reasons returned by the publication API'),
    proves: ['the alert lists every issue the publication API returned, in order', 'the raw problem code is not shown'],
  },
  {
    legacy: c(e2e, 'history explains unpublished revision requirements in en'),
    component: c(requirements, 'history explains unpublished revision requirements in en'),
    proves: [
      'the created revision lists the missing title and slug',
      'publish is disabled while restore stays enabled',
      'the requirements stay inside the viewport',
      'selecting the head revision removes them',
    ],
  },
  {
    legacy: c(e2e, 'history explains unpublished revision requirements in zh'),
    component: c(requirements, 'history explains unpublished revision requirements in zh'),
    proves: [
      'the Chinese requirements and controls render at 390px, where the selection Select replaces the sidebar',
      'the requirements stay inside the viewport in Chinese',
      'selecting the head revision removes them',
    ],
  },
  {
    legacy: c(page, 'history CAS conflict refreshes the baseline and preserves the selected revision for explicit retry'),
    component: c(conflict, 'history CAS conflict refreshes the baseline and preserves the selected revision for explicit retry'),
    proves: [
      'the conflict notice names the change',
      'the selected revision id is preserved for an explicit retry',
      'the refreshed baseline is the newer revision, still current draft',
      'the baseline option is selected and Escape returns focus to the compare control',
      'the conflict is answered by refreshing, never by repeating the refused write',
    ],
  },
  {
    legacy: c(e2e, 'history reconciles an unknown restore result before allowing another mutation'),
    component: c(reconciliation, 'history reconciles an unknown restore result before allowing another mutation'),
    proves: [
      'an unconfirmed restore reports the unknown result and disables the next mutation',
      'no success notice is claimed for the unconfirmed attempt',
      'Refresh history clears the alert and adopts the stored revision as the new baseline',
      'each of nine rounds sends exactly one more write, carrying that round\'s expected version',
      'every round\'s write carries its own idempotency key, so the pending-key budget never runs out',
    ],
  },
]

export type HistoryServerProof = {
  /** The component case whose server answer is a fixture. */
  readonly component: string
  readonly integration: readonly string[]
  readonly proves: readonly string[]
}

/**
 * Server guarantees behind the component cases that answer their own writes.
 *
 * A fixture can return whatever the case wants, so the persisted version, head,
 * live revision and the conflict guard are proved once against the Worker and real
 * D1 instead of being inferred from the component's rendering.
 */
export const historyServerProofs: readonly HistoryServerProof[] = [
  {
    component: c(conflict, 'history CAS conflict refreshes the baseline and preserves the selected revision for explicit retry'),
    integration: [
      c(mutations, 'a stale restore is refused and leaves the racing save as head'),
    ],
    proves: [
      'a restore carrying the version the page held before another tab saved is 409 EDIT_CONFLICT',
      'the persisted head, live revision and version stay as the racing save left them, with no extra revision',
    ],
  },
  {
    component: c(bounds, 'history keeps confirmed publish success when history refresh fails'),
    integration: [
      c(mutations, 'publishing a selected historical revision advances the persisted version exactly once'),
    ],
    proves: [
      'publishing a selected historical revision stores version = the previous version + 1 exactly',
      'the head stays, the selected revision becomes live, and one publication event is recorded',
    ],
  },
  {
    component: c(reconciliation, 'history reconciles an unknown restore result before allowing another mutation'),
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
    cases: ['tests/browser/history/history-interleaving.spec.ts'],
    reason: 'The subject is native browser history and the editor before-leave guard: traversal, repairs and document saves only exist in a live page with the editor.',
  },
]
