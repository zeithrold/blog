/* eslint-disable style/max-len -- Verbatim case references stay on one line. */
import type { CaseMigration } from './types'

const E = 'tests/browser/publication'
const C = 'tests/components/specs'

function c(file: string, title: string): string {
  return `${file} :: ${title}`
}

/**
 * Remaining `tests/browser/publication` cases: what the real editor workspace
 * with the production draft coordinator can prove against explicit HTTP, and
 * the one case that keeps a real Worker plus public SSR assertion.
 *
 * Server facts are deliberately not claimed by these component cases. The real
 * publish/unpublish version guards and live generations stay in
 * `tests/integration/transactions.integration.ts`; schedule storage, cancel and
 * due publication stay in `tests/integration/full-services.integration.ts`,
 * `document-list.integration.ts` and `transactions.integration.ts`; the public
 * reading page is proved by the retained E2E cases. The failed scheduled job
 * transition (`runJob` recording a terminal `errorCode`) is not newly proven by
 * any layer here; the component case asserts the client's rendering of that
 * declared state, which is the same evidence the removed E2E case had.
 *
 * What is not a browser case here:
 * - Pure validation, conflict ordering, metadata mutations, retry and
 *   idempotency rules stay in node:test: `publication-validation.test.ts`,
 *   `editor-publication.test.ts`, `draft-conflict-ordering.test.ts`,
 *   `draft-metadata.test.ts`, `editor-conflict-resolution.test.ts`,
 *   `rich-content.test.ts` (timezone/DST choices) and `api-client.test.ts`.
 *   The component cases assert the rendered wiring and request the client
 *   sends, not those rules a second time.
 * - The conflict notices, save-failure notices, timezone status and failed-plan
 *   explanation are React DOM state. They are Vitest-pilot candidates once the
 *   editor shell can mount without a browser; this change adds no dependency
 *   and keeps them in the native browser because they are reached through the
 *   production BlockNote editor and its coordinator.
 * - The kept native browser reasons are viewport bounds, sticky-header and
 *   scroll/focus behaviour, the real contenteditable snapshot used by Compare
 *   changes, IndexedDB recovery on Use server version, the 390px settings
 *   drawer overflow, and held HTTP responses racing the live list.
 */
export const publicationRemainingMigrations: readonly CaseMigration[] = [
  {
    id: 'publication.conflicts',
    legacy: [
      c(`${E}/publication-conflicts.spec.ts`, 'a clean tab resolves a publish conflict before retrying'),
      c(`${E}/publication-conflicts.spec.ts`, 'a clean tab resolves a unpublish conflict before retrying'),
    ],
    component: [
      {
        case: c(`${C}/publication-remaining.spec.ts`, 'a clean tab resolves a publish conflict before retrying'),
        proves: [
          'the stale publish is answered 409 while the local title stays and the conflict region appears',
          'Compare changes renders the server-version baseline against the local draft snapshot',
          'Use server version adopts the latest saved title and clears the conflict',
          'the retry carries the stale version followed by the adopted version and reaches the live state',
        ],
      },
      {
        case: c(`${C}/publication-remaining.spec.ts`, 'a clean tab resolves a unpublish conflict before retrying'),
        proves: [
          'the stale unpublish is answered 409 while the local title stays and the conflict region appears',
          'Compare changes renders the server-version baseline against the local draft snapshot',
          'Use server version adopts the latest saved title and clears the conflict',
          'the retried unpublish carries the adopted version and clears the public link',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'publication.rejection',
    legacy: [
      c(`${E}/publication-errors.spec.ts`, 'publication explains every rejection at 1440px in en'),
      c(`${E}/publication-errors.spec.ts`, 'publication explains every rejection at 1440px in zh'),
      c(`${E}/publication-errors.spec.ts`, 'publication explains every rejection at 320px in en'),
      c(`${E}/publication-errors.spec.ts`, 'publication explains every rejection at 320px in zh'),
      c(`${E}/publication-errors.spec.ts`, 'publication rejection is revealed from the end of a long document at 1440px'),
      c(`${E}/publication-errors.spec.ts`, 'publication rejection is revealed from the end of a long document at 320px'),
      c(`${E}/publication-errors.spec.ts`, 'correcting a rejected draft clears its reasons and publishes the saved content'),
    ],
    component: [
      {
        case: c(`${C}/publication-remaining.spec.ts`, 'publication explains every rejection at 1440px in en'),
        proves: [
          'the 422 reply issue list renders title, slug, table, mediaSource and image in document order',
          'every localized reason is rendered under Publication checks failed without exposing codes',
          'the notice fits a 1440px viewport',
          'the publish request carries the saved version, live generation and head revision',
        ],
      },
      {
        case: c(`${C}/publication-remaining.spec.ts`, 'publication explains every rejection at 1440px in zh'),
        proves: [
          'the 422 reply issue list and the Chinese heading and reasons match their translations',
          'no error code is rendered in the notice',
          'the notice fits a 1440px viewport',
          'the publish request carries the saved version, live generation and head revision',
        ],
      },
      {
        case: c(`${C}/publication-remaining.spec.ts`, 'publication explains every rejection at 320px in en'),
        proves: [
          'the 422 issue list and reasons render at the narrow layout',
          'the notice stays inside a 320px viewport without horizontal overflow',
          'the publish request carries the saved version, live generation and head revision',
        ],
      },
      {
        case: c(`${C}/publication-remaining.spec.ts`, 'publication explains every rejection at 320px in zh'),
        proves: [
          'the Chinese issue list and reasons render at the narrow layout',
          'the notice stays inside a 320px viewport without horizontal overflow',
          'the publish request carries the saved version, live generation and head revision',
        ],
      },
      {
        case: c(`${C}/publication-remaining.spec.ts`, 'publication rejection is revealed from the end of a long document at 1440px'),
        proves: [
          'after scrolling past 1000px the rejection notice is in view, focused and below the sticky header',
          'the second attempt reveals the same notice again',
        ],
      },
      {
        case: c(`${C}/publication-remaining.spec.ts`, 'publication rejection is revealed from the end of a long document at 320px'),
        proves: [
          'after scrolling past 1000px the rejection notice is in view, focused and below the sticky header',
          'the second attempt reveals the same notice again',
        ],
      },
    ],
    retained: [
      {
        cases: [
          c(`${E}/publication-errors.spec.ts`, 'correcting a rejected draft clears its reasons and publishes the saved content'),
        ],
        reason: 'The corrected publish is a real Worker write and the final assertion reads the public SSR page; a declared component reply cannot establish the stored revision or the rendered public content.',
      },
    ],
  },
  {
    id: 'publication.save-failures',
    legacy: [
      c(`${E}/publication-save-errors.spec.ts`, 'publishing retains the save failure reason DOCUMENT_TOO_LARGE and permits correction'),
      c(`${E}/publication-save-errors.spec.ts`, 'publishing retains the save failure reason INVALID_DOCUMENT and permits correction'),
      c(`${E}/publication-save-errors.spec.ts`, 'publishing retains the save failure reason CONNECTION_FAILED and permits correction'),
    ],
    component: [
      {
        case: c(`${C}/publication-remaining.spec.ts`, 'publishing retains the save failure reason DOCUMENT_TOO_LARGE and permits correction'),
        proves: [
          'the refused autosave shows its reason and sends no publish request',
          'a retried publish before correction leaves the reason in place',
          'after correction one save and one publish succeed, the notice clears and the live link appears',
        ],
      },
      {
        case: c(`${C}/publication-remaining.spec.ts`, 'publishing retains the save failure reason INVALID_DOCUMENT and permits correction'),
        proves: [
          'the refused autosave shows its validation reason and sends no publish request',
          'a retried publish before correction leaves the reason in place',
          'after correction one save and one publish succeed, the notice clears and the live link appears',
        ],
      },
      {
        case: c(`${C}/publication-remaining.spec.ts`, 'publishing retains the save failure reason CONNECTION_FAILED and permits correction'),
        proves: [
          'the aborted autosave shows its connection reason and sends no publish request',
          'a retried publish before correction leaves the reason in place',
          'after correction one save and one publish succeed, the notice clears and the live link appears',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'publication.schedule-cancel-conflict',
    legacy: [
      c(`${E}/schedule-boundaries.spec.ts`, 'cancelling during a cross-tab conflict preserves both drafts'),
    ],
    component: [
      {
        case: c(`${C}/publication-remaining-schedule.spec.ts`, 'cancelling during a cross-tab conflict preserves both drafts'),
        proves: [
          'an external save makes the next autosave conflict while the local title stays editable',
          'cancelling reads the current server version and sends it with the plan id',
          'the conflict and local title survive the metadata write; the client is not backdated to its stale head',
          'the cancelled plan clears the header badge',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'publication.schedule-cancel-failed-save',
    legacy: [
      c(`${E}/schedule-boundaries.spec.ts`, 'cancelling a schedule preserves a draft rejected by autosave at 1440px'),
      c(`${E}/schedule-boundaries.spec.ts`, 'cancelling a schedule preserves a draft rejected by autosave at 390px'),
    ],
    component: [
      {
        case: c(`${C}/publication-remaining-schedule.spec.ts`, 'cancelling a schedule preserves a draft rejected by autosave at 1440px'),
        proves: [
          'a refused autosave keeps the unsaved title and shows its reason',
          'cancelling clears the plan and the Scheduled badge without requiring a save',
          'the preserved title is the document the client saves after the failure clears',
        ],
      },
      {
        case: c(`${C}/publication-remaining-schedule.spec.ts`, 'cancelling a schedule preserves a draft rejected by autosave at 390px'),
        proves: [
          'the mobile settings drawer keeps the refused title and its reason',
          'cancelling clears the plan and the Scheduled badge without requiring a save',
          'the preserved title is the document the client saves after the failure clears',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'publication.schedule-refresh-race',
    legacy: [
      c(`${E}/schedule-boundaries.spec.ts`, 'a delayed schedule refresh cannot restore a cancelled plan or its header badge'),
    ],
    component: [
      {
        case: c(`${C}/publication-remaining-schedule.spec.ts`, 'a delayed schedule refresh cannot restore a cancelled plan or its header badge'),
        proves: [
          'a held list response delivered after cancel cannot restore the pending plan',
          'the cancelled state and the missing header badge persist',
          'Load schedules re-enables after the stale response is ignored',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'publication.schedule-timezone-validation',
    legacy: [
      c(`${E}/schedule-boundaries.spec.ts`, 'timezone validation explains errors locally and ignores outdated failures'),
    ],
    component: [
      {
        case: c(`${C}/publication-remaining-schedule.spec.ts`, 'timezone validation explains errors locally and ignores outdated failures'),
        proves: [
          'searching an unknown zone filters locally without a schedule-time request',
          'a TIMEZONE_INVALID reply is translated in the form status',
          'a held stale failure is ignored after the zone changes and the fresh choices enable scheduling',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'publication.schedule-failed-plan',
    legacy: [
      c(`${E}/schedule-boundaries.spec.ts`, 'refreshing a failed plan updates the header and translates its rejection code'),
      c(`${E}/schedule-boundaries.spec.ts`, 'failed schedule explanations fit the Chinese mobile drawer'),
    ],
    component: [
      {
        case: c(`${C}/publication-remaining-schedule.spec.ts`, 'refreshing a failed plan updates the header and translates its rejection code'),
        proves: [
          'a refreshed failed plan renders the translated PUBLICATION_CONFLICT explanation',
          'the header no longer claims a pending schedule',
        ],
      },
      {
        case: c(`${C}/publication-remaining-schedule.spec.ts`, 'failed schedule explanations fit the Chinese mobile drawer'),
        proves: [
          'the Chinese failed-plan explanation renders in the mobile settings drawer',
          'the drawer does not overflow a 390px viewport horizontally',
        ],
      },
    ],
    retained: [],
  },
]
