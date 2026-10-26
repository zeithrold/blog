/* eslint-disable max-lines, style/max-len -- Verbatim case references stay on one line. */
import type { DocumentsCatalogContract } from './documents-catalog'
import { adminDomMigrations } from './admin-dom-migrations'
import { documentsCatalogDomMigrations } from './documents-catalog-dom-migrations'
import { editorChromeDomMigrations } from './editor-chrome-dom-migrations'
import { formattingDomMigrations } from './formatting-dom-migrations'
import { mediaDomMigrations } from './media-dom-migrations'
import { overlayDomMigrations } from './overlay-dom-migrations'
import { publicationDomMigrations } from './publication-dom-migrations'
import { readerDomMigrations } from './reader-dom-migrations'
import { referencesDomMigrations } from './references-dom-migrations'
import { sourceDomMigrations } from './source-dom-migrations'
import { tableDomMigrations } from './table-dom-migrations'

/**
 * Where a jsdom case now carries work an older native case owned.
 *
 * `componentMigrations` records one generation of moves: a Playwright E2E case
 * whose assertions were rewritten against the real component harness. The `dom`
 * layer is a second generation, and it can succeed either of those cases, so it
 * keeps its own record instead of overloading `legacy` with a different meaning.
 *
 * A record is the only source of DOM contract references: `registry.ts` composes
 * `contract.dom` from `dom[].contracts`, exactly as it composes component
 * references. A DOM case therefore cannot enter the ledger as proof without
 * naming the old case it succeeds — an old case that goes missing is never read
 * as permission. `tests/ci/dom-layer.test.ts` checks both sides: the declared DOM
 * cases must be the layer's real cases, and every `legacy` key must still run in
 * its own layer unless the record explicitly retired it.
 *
 * Nothing here deletes a Playwright case. `retained` names the old cases that
 * still run unchanged, so the same change that removes one also removes it from
 * `retained` and lets the gate confirm it is gone. Files are referenced by the
 * keys below so each entry stays one readable line.
 */
export type DomCase = {
  /** A jsdom case under `tests/dom/`: `<file> :: <title>`. */
  readonly case: string
  /** Suite path when the case is nested; omitted means a top-level case. */
  readonly describe?: readonly string[]
  /** Contract rules this case proves, named exactly as in the ledger. */
  readonly contracts?: readonly DocumentsCatalogContract['id'][]
  /** The old assertions this case now proves. */
  readonly proves: readonly string[]
}

export type DomMigrationRecord = {
  readonly id: string
  /** Old native cases this record owns: `<file> :: <title>`, in any layer. */
  readonly legacy: readonly string[]
  readonly dom: readonly DomCase[]
  /** Old cases that still run unchanged, and why they have not moved. */
  readonly retained: readonly { readonly cases: readonly string[], readonly reason: string }[]
}

const model = 'tests/dom/history-page-model.test.tsx'
const outcomes = 'tests/dom/history-state-outcomes.test.tsx'
const selection = 'tests/dom/history-state-selection.test.tsx'
const domReconciliation = 'tests/dom/history-state-reconciliation.test.tsx'
const e2e = 'tests/browser/history/history-boundaries.spec.ts'
const boundaries = 'tests/components/specs/history-boundaries.spec.ts'
const conflict = 'tests/components/specs/history-conflict.spec.ts'
const reconciliation = 'tests/components/specs/history-reconciliation.spec.ts'
const conflictNoticeE2e = 'tests/browser/history/conflict-notice-polish.spec.ts'
const previewE2e = 'tests/browser/history/preview-history-polish.spec.ts'
const noticeSpec = 'tests/components/specs/editor-history-remaining-conflict.spec.ts'
const previewSpec = 'tests/components/specs/editor-history-remaining-preview.spec.ts'
const conflictRemaining = 'tests/dom/history-conflict-remaining.test.tsx'
const previewEntriesDom = 'tests/dom/history-preview-remaining-entries.test.tsx'
const previewRecoveryDom = 'tests/dom/history-preview-remaining-recovery.test.tsx'
const focusE2e = 'tests/browser/history/editor-history-focus.spec.ts'
const compareE2e = 'tests/browser/history/history.spec.ts'
const guardDom = 'tests/dom/history-guard-state.test.tsx'
const comparisonDom = 'tests/dom/history-comparison-state.test.tsx'
const departureDom = 'tests/dom/history-departure-policy.test.tsx'
const widths = [
  320,
  390,
  1440,
]
const compactWidths = [320, 390]
const locales = ['en', 'zh'] as const

function at(file: string, title: string): string {
  return `${file} :: ${title}`
}

// The eight fully retired cases keep both generations in one checked record: the
// original E2E key it was rewritten to, then the component key it moved to. The
// retention gate resolves each key's layer from its file, so the E2E case is still
// proved gone and the component case still proved gone. Each record names the exact
// jsdom case that now carries the assertions. The conflict case is only split, so
// it stays retained and its E2E key remains in `historyMigrations`.
export const domMigrations: readonly DomMigrationRecord[] = [
  {
    id: 'history.page-outcomes',
    legacy: [
      at(e2e, 'history keeps confirmed restore success when history refresh fails'),
      at(boundaries, 'history keeps confirmed restore success when history refresh fails'),
      at(e2e, 'history keeps confirmed publish success when history refresh fails'),
      at(boundaries, 'history keeps confirmed publish success when history refresh fails'),
      at(e2e, 'history retries an uncommitted disconnected operation with the same idempotency key'),
      at(boundaries, 'history retries an uncommitted disconnected operation with the same idempotency key'),
      at(e2e, 'history explains a definite maintenance rejection without calling it an unknown result'),
      at(boundaries, 'history explains a definite maintenance rejection without calling it an unknown result'),
      at(e2e, 'a new failed history operation clears the previous success notice'),
      at(boundaries, 'a new failed history operation clears the previous success notice'),
      at(e2e, 'history displays actionable reasons returned by the publication API'),
      at(boundaries, 'history displays actionable reasons returned by the publication API'),
    ],
    dom: [
      {
        case: at(model, 'treats a maintenance rejection as a definite failure'),
        proves: [
          'a 503 MAINTENANCE is a definite failure, not an unconfirmed result',
          'no read follows the refusal, so publish stays available for a later attempt',
        ],
      },
      {
        case: at(model, 'keeps a lost response unknown and reuses the idempotency key for the retry'),
        proves: [
          'a lost response reports an unconfirmed result and asks for a refresh',
          'the retry repeats the original path, body and idempotency key',
        ],
      },
      {
        case: at(model, 'publishes with the version, revision and live generation the page saw'),
        proves: [
          'the write carries the version, revision and live generation the page held',
          'the acknowledgement moves the baseline to the committed head',
        ],
      },
      {
        case: at(model, 'keeps a confirmed restore visible when the following refresh fails'),
        proves: [
          'a confirmed restore keeps its own notice while the refused read reports itself',
          'the confirmed version and head stay on the page after the failed refresh',
        ],
      },
      {
        case: at(outcomes, 'keeps the confirmed restore when the following history read is refused'),
        proves: [
          'the confirmed restore keeps its own notice while the refused history read reports itself',
          'the refused read locks restore, publish and compare with the refresh message',
          'Refresh history clears the alert and re-enables compare',
          'the confirmed state still shows the restored revision title',
          'the single write names the selected revision and the version the page held',
        ],
      },
      {
        case: at(outcomes, 'keeps the confirmed publish and the new live generation when the following read is refused'),
        proves: [
          'the confirmed publish keeps its own notice while the refused document read reports itself',
          'the refused read locks restore, publish and compare with the refresh message',
          'Refresh history clears the alert, and the revision that is now live cannot be published again',
          'the single write carries the live generation and the selected revision',
        ],
      },
      {
        case: at(outcomes, 'retries a disconnected restore from the page with the same idempotency key'),
        proves: [
          'the lost response reports an unconfirmed result instead of success',
          'Refresh history clears it without committing anything',
          'the retry repeats the original path, body and idempotency key',
          'the retry then reports the created draft',
        ],
      },
      {
        case: at(outcomes, 'reports a maintenance refusal as a definite failure that stays retryable'),
        proves: [
          'the maintenance refusal keeps its own message',
          'it never reads as an unconfirmed result',
          'publish stays enabled for a later attempt, and no read follows the refusal',
        ],
      },
      {
        case: at(outcomes, 'replaces an earlier success notice with the refusal of the next restore'),
        proves: [
          'a confirmed restore shows its status',
          'a following refused restore shows the owner error',
          'the older success notice is gone',
        ],
      },
      {
        case: at(outcomes, 'lists the publication reasons the API refused the publish with'),
        proves: [
          'the alert lists every issue the publication API returned, in order',
          'the raw problem code is not shown',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'history.page-selection',
    legacy: [
      at(e2e, 'history keeps a conflict readable when loading the new baseline fails'),
      at(boundaries, 'history keeps a conflict readable when loading the new baseline fails'),
    ],
    dom: [
      {
        case: at(selection, 'keeps the conflict readable when loading the new baseline is refused'),
        proves: [
          'the conflict notice survives a refused baseline read',
          'the alert names the required refresh and locks restore',
          'after Refresh history the baseline is the newer revision and restore unlocks',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'history.page-reconciliation',
    legacy: [
      at(e2e, 'history reconciles an unknown restore result before allowing another mutation'),
      at(reconciliation, 'history reconciles an unknown restore result before allowing another mutation'),
    ],
    dom: [
      {
        case: at(model, 'keeps an unavailable write unknown and refuses a second write'),
        proves: [
          'a 503 UNAVAILABLE stays an unconfirmed outcome that asks for a refresh',
          'the refused lock keeps a second write off the wire',
        ],
      },
      {
        case: at(domReconciliation, 'reconciles nine unconfirmed restores and writes each round with its own key'),
        proves: [
          'an unconfirmed restore reports the unknown result and disables the next mutation',
          'no success notice is claimed for the unconfirmed attempt',
          'Refresh history clears the alert and adopts the stored revision as the new baseline',
          'each of nine rounds sends exactly one more write, carrying that round\'s expected version',
          'every round\'s write carries its own idempotency key, so the pending-key budget never runs out',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'history.page-conflict',
    legacy: [
      at(conflict, 'history CAS conflict refreshes the baseline and preserves the selected revision for explicit retry'),
    ],
    dom: [
      {
        case: at(model, 'refreshes the server state on a CAS conflict and keeps the chosen revision'),
        proves: [
          'a 409 EDIT_CONFLICT is answered by reading, never by repeating the refused write',
          'the refresh adopts the server head and keeps the chosen revision selected',
        ],
      },
      {
        case: at(selection, 'adopts the refreshed baseline without a manual refresh after a conflict'),
        proves: [
          'the conflict notice names the change',
          'the selected revision is preserved for an explicit retry',
          'the refreshed baseline is the newer revision, still the current draft, and adopts it without a manual refresh',
          'the conflict is answered by refreshing, never by repeating the refused write',
        ],
      },
    ],
    retained: [
      {
        cases: [
          at(conflict, 'history CAS conflict refreshes the baseline and preserves the selected revision for explicit retry'),
        ],
        reason: 'Split, not retired: the jsdom cases prove the refreshed baseline, the preserved selection and the single refused write. This browser case keeps the one fact the jsdom harness cannot hold: opening the compare list marks the chosen option aria-selected, and Escape returns focus to the trigger.',
      },
    ],
  },
  {
    id: 'history.conflict-remaining',
    legacy: [
      at(conflictNoticeE2e, 'a pending conflict refresh explains preserved document edits and merges into one actionable notice'),
      at(noticeSpec, 'a pending conflict refresh explains preserved document edits and merges into one actionable notice'),
      ...widths.flatMap(width => locales.flatMap(locale => [
        at(conflictNoticeE2e, `conflict choices and refreshed comparison remain accessible at ${width}px in ${locale}`),
        at(noticeSpec, `conflict choices and refreshed comparison remain accessible at ${width}px in ${locale}`),
      ])),
    ],
    dom: [
      {
        case: at(conflictRemaining, 'a pending conflict refresh explains preserved document edits and merges into one actionable notice'),
        proves: [
          'the pending notice is rendered while the newer draft is read and names no catalog concept',
          'the merged notice appears, the pending notice is gone, no alert remains, and exactly one conflict notice stays',
          'no publication write is sent and every request is served',
        ],
      },
      {
        case: at(conflictRemaining, 'conflict choices describe both drafts and the refreshed comparison in en'),
        proves: [
          'the notice is one conflict-tone region with no competing error and no alert',
          'the compare control is a ghost disclosure; both choices are outlined and described by their own help text',
          'comparing opens the comparison and the changed paragraph appears once with the server draft before and the local draft after',
          'the disclosure collapses and reopens, and editing marks the comparison stale',
          'only the refused revision save was attempted and no publication write is sent',
        ],
      },
      {
        case: at(conflictRemaining, 'conflict choices describe both drafts and the refreshed comparison in zh-CN'),
        proves: [
          'the Chinese notice is one conflict-tone region with no competing error and no alert',
          'the compare control is a ghost disclosure; both choices are outlined and described by their own help text',
          'comparing opens the comparison and the changed paragraph appears once with the server draft before and the local draft after',
          'the disclosure collapses and reopens, and editing marks the comparison stale',
          'only the refused revision save was attempted and no publication write is sent',
        ],
      },
      {
        case: at(conflictRemaining, 'the conflict actions write only the refused save and an unavailable recovery copy never reopens'),
        proves: [
          'keeping the local edits opens the replacement dialog, and cancelling leaves the draft untouched',
          'asking for the server version with no IndexedDB keeps the draft, reports the unavailable recovery copy and does not reopen',
          'the actions write nothing the refused save had not already written, and no publication write is sent',
        ],
      },
    ],
    retained: [
      {
        cases: [
          at(noticeSpec, 'a pending conflict refresh explains preserved document edits and merges into one actionable notice'),
          ...widths.flatMap(width => locales.map(locale => at(noticeSpec, `conflict choices and refreshed comparison remain accessible at ${width}px in ${locale}`))),
        ],
        reason: 'Split, not retired: the jsdom conflict cases prove the notice copy, the choice variants and descriptions, the comparison text, the stale recompute and the request log. These browser cases keep the live BlockNote body, painted icons, viewport bounds, 44px targets, native focus return and the reopened server draft.',
      },
    ],
  },
  {
    id: 'history.preview-remaining',
    legacy: [
      ...widths.flatMap(width => locales.flatMap(locale => [
        at(previewE2e, `both preview entries show the unsaved draft without remounting at ${width}px in ${locale}`),
        at(previewSpec, `both preview entries show the unsaved draft without remounting at ${width}px in ${locale}`),
      ])),
    ],
    dom: [
      {
        case: at(previewEntriesDom, 'offers exactly one draft preview entry in the content tab in en'),
        proves: ['the real Content tab renders exactly one draft-preview entry and no saved-revision preview link'],
      },
      {
        case: at(previewEntriesDom, 'offers exactly one draft preview entry in the content tab in zh-CN'),
        proves: [
          'the Chinese real Content tab renders exactly one draft-preview entry and no saved-revision preview link',
        ],
      },
      {
        case: at(previewEntriesDom, 'opens one draft preview from the content tab and the action menu in en'),
        proves: [
          'the Content tab entry and the action menu entry open the same single preview dialog',
          'the reader region renders the current unsaved draft and not the saved revision',
          'a complete draft shows no preview error',
        ],
      },
      {
        case: at(previewEntriesDom, 'opens one draft preview from the content tab and the action menu in zh-CN'),
        proves: [
          'the Chinese Content tab entry and action menu entry open the same single preview dialog',
          'the reader region renders the current unsaved draft and not the saved revision',
          'a complete draft shows no preview error',
        ],
      },
      {
        case: at(previewEntriesDom, 'opens one draft preview from the compact action drawer in en'),
        proves: ['the compact action drawer opens the same single preview dialog and closes behind it'],
      },
      {
        case: at(previewEntriesDom, 'opens one draft preview from the compact action drawer in zh-CN'),
        proves: ['the Chinese compact action drawer opens the same single preview dialog and closes behind it'],
      },
      {
        case: at(previewEntriesDom, 'closes the draft preview and reopens it with the current draft in en'),
        proves: [
          'closing the preview removes the only dialog, and reopening it reads the current draft again',
          'previewing from either entry issues no request, so it publishes nothing',
        ],
      },
      {
        case: at(previewEntriesDom, 'closes the draft preview and reopens it with the current draft in zh-CN'),
        proves: [
          'closing the Chinese preview removes the only dialog, and reopening it reads the current draft again',
          'previewing from either entry issues no request, so it publishes nothing',
        ],
      },
    ],
    retained: [
      {
        cases: widths.flatMap(width => locales.map(locale => at(previewSpec, `both preview entries show the unsaved draft without remounting at ${width}px in ${locale}`))),
        reason: 'Split, not retired: jsdom proves the Content tab entry, desktop menu and compact drawer semantics, the single dialog, current draft, absent error, close/reopen and zero requests. Browser cases keep real drawer and menu geometry, the live BlockNote snapshot, native focus return and editor identity.',
      },
    ],
  },
  {
    id: 'history.local-recovery',
    legacy: [
      ...compactWidths.flatMap(width => locales.flatMap(locale => [
        at(previewE2e, `local recovery is readable, dismissible and recoverable at ${width}px in ${locale}`),
        at(previewSpec, `local recovery is readable, dismissible and recoverable at ${width}px in ${locale}`),
      ])),
    ],
    dom: [
      {
        case: at(previewRecoveryDom, 'offers the stored local copy with its saved time and both actions in en'),
        proves: [
          'the notice names the stored local copy and shows its own description',
          'its time element carries the stored instant and a visible year under the Saved label',
          'the tone icon and both action icons are present and decorative; both actions are named Open recovered draft and Dismiss',
        ],
      },
      {
        case: at(previewRecoveryDom, 'offers the stored local copy with its saved time and both actions in zh-CN'),
        proves: [
          'the Chinese notice names the stored local copy and shows its own description',
          'its time element carries the stored instant and a visible year under the Saved label',
          'the tone icon and both action icons are present and decorative; both actions are named Open recovered draft and Dismiss',
        ],
      },
      {
        case: at(previewRecoveryDom, 'reopens the stored local copy from the notice in en'),
        proves: [
          'dismissing the notice removes it, and reopening it hands the stored document and its base revision to the session',
          'reading or dismissing the notice issues no request',
        ],
      },
      {
        case: at(previewRecoveryDom, 'reopens the stored local copy from the notice in zh-CN'),
        proves: [
          'dismissing the Chinese notice removes it, and reopening it hands the stored document and its base revision to the session',
          'reading or dismissing the notice issues no request',
        ],
      },
    ],
    retained: [
      {
        cases: compactWidths.flatMap(width => locales.map(locale => at(previewSpec, `local recovery is readable, dismissible and recoverable at ${width}px in ${locale}`))),
        reason: 'Split, not retired: the jsdom recovery cases prove the notice copy, the saved time, the action names, the dismissal and the zero-request proof. These browser cases keep the real IndexedDB round trip, the reload survival, viewport geometry and 44px targets, painted icons, and applying the copy to the live editor.',
      },
    ],
  },
  {
    id: 'history.guard-menu',
    legacy: [
      at(focusE2e, 'mobile cancellation returns to the menu trigger'),
    ],
    dom: [
      {
        case: at(guardDom, 'hands the context the guard the caller registers and clears it when unregistered'),
        proves: [
          'the context holds exactly the guard the caller registered, and the caller\'s own flag decides whether one is held',
        ],
      },
      {
        case: at(guardDom, 'exposes the context cancel and the registration cancel a refusal runs'),
        proves: [
          'the guard context and registration each expose their cancellation callback, and the resolver stays available afterwards',
        ],
      },
      {
        case: at(departureDom, 'asks an editor with unsaved work before it leaves, and stays when the reader stays'),
        proves: [
          'an editor holding unsaved work opens the saving dialog instead of leaving',
          'the dialog reports that held save, and its own Stay here returns the departure to idle; the held save then completes with no dialog and no unsaved work',
        ],
      },
      {
        case: at(departureDom, 'asks an editor that is still uploading, and hands nothing over when the reader stays'),
        proves: [
          'an editor that is still uploading is asked too, and staying hands nothing over',
          'crossing the policy\'s 40ms wait after the upload completes resumes that continuation, which finds the refusal: no dialog, no packet and no call',
        ],
      },
      {
        case: at(departureDom, 'lets an idle editor leave without a dialog or a packet'),
        proves: ['an idle editor is handed straight to the host router with no dialog and no packet'],
      },
    ],
    retained: [
      {
        cases: [
          at(focusE2e, 'mobile cancellation returns to the menu trigger'),
        ],
        reason: 'Split, not yet trimmed: the jsdom guard and departure-policy cases prove the registration, cancel and policy state. The browser case still keeps the mobile drawer Tags menuitem navigation, native focus return to the .workspace-navigation-mobile trigger, and the route itself; the host adapter has no onNavigate and jsdom implements no document navigation.',
      },
    ],
  },
  {
    id: 'history.guard-title',
    legacy: [
      at(focusE2e, 'mobile cancellation returns to the edited title'),
    ],
    dom: [
      {
        case: at(guardDom, 'requests the chosen target, stays when it is refused and moves when it is approved'),
        proves: [
          'an external traversal asks the guard with the destination href and returns handled to its driver',
          'a pop the driver reports as its own repair completes the repair instead of asking again',
          'refusing voids the pending approval, so a late commit moves nothing',
          'an approved departure moves to the target the reader chose',
        ],
      },
    ],
    retained: [
      {
        cases: [
          at(focusE2e, 'mobile cancellation returns to the edited title'),
        ],
        reason: 'Split, not yet trimmed: the jsdom guard case proves the target request, refusal and approval. The browser case still keeps history.back() delivery, the Navigation API marker and native focus return to the edited title field; the route itself stays native.',
      },
    ],
  },
  {
    id: 'history.comparison',
    legacy: [
      at(compareE2e, 'history compares stable blocks, restores a new head and publishes a selected historical revision'),
    ],
    dom: [
      {
        case: at(comparisonDom, 'reports no differences when the baseline is the selected revision'),
        proves: [
          'choosing the selected revision as the baseline removes every difference row and says the revisions contain the same content',
        ],
      },
    ],
    retained: [
      {
        cases: [
          at(compareE2e, 'history compares stable blocks, restores a new head and publishes a selected historical revision'),
        ],
        reason: 'Split, not yet trimmed: the jsdom comparison case proves the same-revision baseline removes every difference. The browser case still keeps the pointer listbox, the stored head/live/version and the published reader routes.',
      },
    ],
  },
  ...readerDomMigrations,
  ...referencesDomMigrations,
  ...sourceDomMigrations,
  ...documentsCatalogDomMigrations,
  ...tableDomMigrations,
  ...mediaDomMigrations,
  ...adminDomMigrations,
  ...editorChromeDomMigrations,
  ...formattingDomMigrations,
  // The overlay package retired no case to jsdom; the module states that
  // decision where the rest of the layer's records live.
  ...overlayDomMigrations,
  ...publicationDomMigrations,
]
