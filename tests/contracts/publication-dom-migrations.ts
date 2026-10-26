/* eslint-disable style/max-len -- Verbatim case references stay on one line. */
import type { DomMigrationRecord } from './dom-migrations'

const e2e = 'tests/browser/publication'
const component = 'tests/components/specs'
const dom = 'tests/dom'

function at(file: string, title: string): string {
  return `${file} :: ${title}`
}

export const publicationDomMigrations: readonly DomMigrationRecord[] = [
  {
    id: 'publication.conflicts',
    legacy: [
      at(`${e2e}/publication-conflicts.spec.ts`, 'a clean tab resolves a publish conflict before retrying'),
      at(`${e2e}/publication-conflicts.spec.ts`, 'a clean tab resolves a unpublish conflict before retrying'),
      at(`${component}/publication-remaining.spec.ts`, 'a clean tab resolves a publish conflict before retrying'),
      at(`${component}/publication-remaining.spec.ts`, 'a clean tab resolves a unpublish conflict before retrying'),
    ],
    dom: [
      {
        case: at(`${dom}/publication-remaining.test.tsx`, 'a clean tab resolves a publish conflict before retrying'),
        contracts: [],
        proves: [
          'the conflict notice replaces the generic error and keeps the saved status at conflict',
          'the publish control disables and Compare changes renders the baseline summary',
          'the refused publish carries the loaded version and live generation',
        ],
      },
      {
        case: at(`${dom}/publication-remaining.test.tsx`, 'a clean tab resolves a unpublish conflict before retrying'),
        contracts: [],
        proves: [
          'the conflict notice replaces the generic error and keeps the saved status at conflict',
          'the publish control disables and Compare changes renders the baseline summary',
          'the refused unpublish carries the loaded version and live generation',
        ],
      },
    ],
    retained: [
      {
        cases: [
          at(`${component}/publication-remaining.spec.ts`, 'a clean tab resolves a publish conflict before retrying'),
          at(`${component}/publication-remaining.spec.ts`, 'a clean tab resolves a unpublish conflict before retrying'),
        ],
        reason: 'Compare changes must read the live BlockNote contenteditable snapshot, and Use server version exercises browser IndexedDB recovery; jsdom only asserts its unavailable-storage path.',
      },
    ],
  },
  {
    id: 'publication.rejection',
    legacy: [
      at(`${e2e}/publication-errors.spec.ts`, 'publication explains every rejection at 1440px in en'),
      at(`${e2e}/publication-errors.spec.ts`, 'publication explains every rejection at 1440px in zh'),
      at(`${e2e}/publication-errors.spec.ts`, 'publication explains every rejection at 320px in en'),
      at(`${e2e}/publication-errors.spec.ts`, 'publication explains every rejection at 320px in zh'),
      at(`${e2e}/publication-errors.spec.ts`, 'publication rejection is revealed from the end of a long document at 1440px'),
      at(`${e2e}/publication-errors.spec.ts`, 'publication rejection is revealed from the end of a long document at 320px'),
      at(`${e2e}/publication-errors.spec.ts`, 'correcting a rejected draft clears its reasons and publishes the saved content'),
      at(`${component}/publication-remaining.spec.ts`, 'publication explains every rejection at 1440px in en'),
      at(`${component}/publication-remaining.spec.ts`, 'publication explains every rejection at 1440px in zh'),
      at(`${component}/publication-remaining.spec.ts`, 'publication explains every rejection at 320px in en'),
      at(`${component}/publication-remaining.spec.ts`, 'publication explains every rejection at 320px in zh'),
      at(`${component}/publication-remaining.spec.ts`, 'publication rejection is revealed from the end of a long document at 1440px'),
      at(`${component}/publication-remaining.spec.ts`, 'publication rejection is revealed from the end of a long document at 320px'),
    ],
    dom: [
      {
        case: at(`${dom}/publication-remaining.test.tsx`, 'publication explains every rejection in en'),
        contracts: [],
        proves: [
          'the English publication heading and five ordered reasons render for the declared 422 response',
          'raw problem codes stay out of the notice',
          'the request carries the loaded version, live generation and head revision',
        ],
      },
      {
        case: at(`${dom}/publication-remaining.test.tsx`, 'publication explains every rejection in zh-CN'),
        contracts: [],
        proves: [
          'the Chinese publication heading and five ordered reasons render for the declared 422 response',
          'raw problem codes stay out of the notice',
          'the request carries the loaded version, live generation and head revision',
        ],
      },
      {
        case: at(`${dom}/publication-remaining.test.tsx`, 'a refused publication renders its server error heading'),
        contracts: [],
        proves: ['a PUBLICATION_INVALID response renders the rejection heading and its server-provided reason'],
      },
    ],
    retained: [
      {
        cases: [
          at(`${component}/publication-remaining.spec.ts`, 'publication explains every rejection at 1440px in en'),
          at(`${component}/publication-remaining.spec.ts`, 'publication explains every rejection at 1440px in zh'),
        ],
        reason: 'The English and Chinese notice bounds are measured against the 1440px browser viewport.',
      },
      {
        cases: [
          at(`${component}/publication-remaining.spec.ts`, 'publication explains every rejection at 320px in en'),
          at(`${component}/publication-remaining.spec.ts`, 'publication explains every rejection at 320px in zh'),
        ],
        reason: 'The notice bounds and page horizontal overflow are measured at 320px.',
      },
      {
        cases: [
          at(`${component}/publication-remaining.spec.ts`, 'publication rejection is revealed from the end of a long document at 1440px'),
          at(`${component}/publication-remaining.spec.ts`, 'publication rejection is revealed from the end of a long document at 320px'),
        ],
        reason: 'The live BlockNote body is scrolled beyond 1000px; native focus, viewport visibility, and sticky-header clearance are measured on both attempts.',
      },
      {
        cases: [
          at(`${e2e}/publication-errors.spec.ts`, 'correcting a rejected draft clears its reasons and publishes the saved content'),
        ],
        reason: 'The corrected publish is a real Worker write and the final assertion reads the public SSR page, so declared jsdom replies cannot prove stored or public content.',
      },
    ],
  },
  {
    id: 'publication.save-failures',
    legacy: [
      at(`${e2e}/publication-save-errors.spec.ts`, 'publishing retains the save failure reason DOCUMENT_TOO_LARGE and permits correction'),
      at(`${e2e}/publication-save-errors.spec.ts`, 'publishing retains the save failure reason INVALID_DOCUMENT and permits correction'),
      at(`${e2e}/publication-save-errors.spec.ts`, 'publishing retains the save failure reason CONNECTION_FAILED and permits correction'),
      at(`${component}/publication-remaining.spec.ts`, 'publishing retains the save failure reason DOCUMENT_TOO_LARGE and permits correction'),
      at(`${component}/publication-remaining.spec.ts`, 'publishing retains the save failure reason INVALID_DOCUMENT and permits correction'),
      at(`${component}/publication-remaining.spec.ts`, 'publishing retains the save failure reason CONNECTION_FAILED and permits correction'),
    ],
    dom: [
      {
        case: at(`${dom}/publication-remaining.test.tsx`, 'publishing retains the save failure reason DOCUMENT_TOO_LARGE and permits correction'),
        contracts: [],
        proves: [
          'the failed save reason and save status render while no publish request is sent',
          'retrying before correction keeps the reason visible',
          'a corrected title saves and publishes using the saved head revision',
        ],
      },
      {
        case: at(`${dom}/publication-remaining.test.tsx`, 'publishing retains the save failure reason INVALID_DOCUMENT and permits correction'),
        contracts: [],
        proves: [
          'the failed save reason and save status render while no publish request is sent',
          'retrying before correction keeps the reason visible',
          'a corrected title saves and publishes using the saved head revision',
        ],
      },
      {
        case: at(`${dom}/publication-remaining.test.tsx`, 'publishing retains the save failure reason CONNECTION_FAILED and permits correction'),
        contracts: [],
        proves: [
          'the failed save reason and offline status render while no publish request is sent',
          'retrying before correction keeps the reason visible',
          'a corrected title saves and publishes using the saved head revision',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'publication.schedule-cancel-conflict',
    legacy: [
      at(`${e2e}/schedule-boundaries.spec.ts`, 'cancelling during a cross-tab conflict preserves both drafts'),
      at(`${component}/publication-remaining-schedule.spec.ts`, 'cancelling during a cross-tab conflict preserves both drafts'),
    ],
    dom: [
      {
        case: at(`${dom}/publication-remaining-schedule.test.tsx`, 'cancelling during a cross-tab conflict preserves both drafts'),
        contracts: [],
        proves: [
          'the refused autosave renders conflict state while the local title remains',
          'cancelling preserves the conflict and local title while the schedule status and controls update',
          'the cancel request carries the plan id and latest version',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'publication.schedule-cancel-failed-save',
    legacy: [
      at(`${e2e}/schedule-boundaries.spec.ts`, 'cancelling a schedule preserves a draft rejected by autosave at 1440px'),
      at(`${e2e}/schedule-boundaries.spec.ts`, 'cancelling a schedule preserves a draft rejected by autosave at 390px'),
      at(`${component}/publication-remaining-schedule.spec.ts`, 'cancelling a schedule preserves a draft rejected by autosave at 1440px'),
      at(`${component}/publication-remaining-schedule.spec.ts`, 'cancelling a schedule preserves a draft rejected by autosave at 390px'),
    ],
    dom: [
      {
        case: at(`${dom}/publication-remaining-schedule.test.tsx`, 'cancelling a schedule preserves a draft rejected by autosave'),
        contracts: [],
        proves: [
          'the refused autosave keeps the local title and renders its failure reason',
          'cancelling clears the scheduled badge and controls without clearing the draft error',
          'after correction the client saves the corrected title and clears the error',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'publication.schedule-refresh-race',
    legacy: [
      at(`${e2e}/schedule-boundaries.spec.ts`, 'a delayed schedule refresh cannot restore a cancelled plan or its header badge'),
      at(`${component}/publication-remaining-schedule.spec.ts`, 'a delayed schedule refresh cannot restore a cancelled plan or its header badge'),
    ],
    dom: [
      {
        case: at(`${dom}/publication-remaining-schedule.test.tsx`, 'a delayed schedule refresh cannot restore a cancelled plan or its header badge'),
        contracts: [],
        proves: [
          'a response held before cancel cannot restore the pending plan after cancellation',
          'the cancelled state and missing header badge remain, and Load schedules re-enables',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'publication.schedule-timezone-validation',
    legacy: [
      at(`${e2e}/schedule-boundaries.spec.ts`, 'timezone validation explains errors locally and ignores outdated failures'),
      at(`${component}/publication-remaining-schedule.spec.ts`, 'timezone validation explains errors locally and ignores outdated failures'),
    ],
    dom: [
      {
        case: at(`${dom}/publication-remaining-schedule.test.tsx`, 'timezone validation translates status and ignores outdated failures'),
        contracts: [],
        proves: [
          'an unknown timezone is filtered locally without a schedule-time request',
          'TIMEZONE_INVALID renders as translated form status',
          'a stale held failure is ignored after the selected timezone changes, and a verified choice enables scheduling',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'publication.schedule-failed-plan',
    legacy: [
      at(`${e2e}/schedule-boundaries.spec.ts`, 'refreshing a failed plan updates the header and translates its rejection code'),
      at(`${e2e}/schedule-boundaries.spec.ts`, 'failed schedule explanations fit the Chinese mobile drawer'),
      at(`${component}/publication-remaining-schedule.spec.ts`, 'refreshing a failed plan updates the header and translates its rejection code'),
      at(`${component}/publication-remaining-schedule.spec.ts`, 'failed schedule explanations fit the Chinese mobile drawer'),
    ],
    dom: [
      {
        case: at(`${dom}/publication-remaining-schedule.test.tsx`, 'refreshing a failed plan translates its rejection and removes the header badge'),
        contracts: [],
        proves: [
          'refreshing a failed plan renders the translated PUBLICATION_CONFLICT explanation',
          'the header no longer claims a pending schedule',
        ],
      },
      {
        case: at(`${dom}/publication-remaining-schedule.test.tsx`, 'failed schedule explanation renders in zh-CN'),
        contracts: [],
        proves: ['the Chinese failed-plan explanation renders for the declared failed item'],
      },
    ],
    retained: [
      {
        cases: [
          at(`${component}/publication-remaining-schedule.spec.ts`, 'failed schedule explanations fit the Chinese mobile drawer'),
        ],
        reason: 'The translated drawer error and document are checked for horizontal overflow at 390px in a real browser.',
      },
    ],
  },
]
