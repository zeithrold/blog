/* eslint-disable style/max-len -- Exact registered Playwright keys stay on one line. */
/**
 * DOM/client assertions moved from the remaining publication component cases.
 * The E2E → component → DOM keys are recorded in
 * `tests/contracts/publication-dom-migrations.ts`.
 */

export type DomRetirement = {
  readonly playwright: string
  readonly dom: readonly string[]
  readonly proves: readonly string[]
  readonly remainsBrowser: readonly string[]
}

const publication = 'tests/components/specs/publication-remaining.spec.ts'
const schedule = 'tests/components/specs/publication-remaining-schedule.spec.ts'
const publicationDom = 'tests/dom/publication-remaining.test.tsx'
const scheduleDom = 'tests/dom/publication-remaining-schedule.test.tsx'

function at(file: string, title: string): string {
  return `${file} :: ${title}`
}

export const domRetirements: readonly DomRetirement[] = [
  {
    playwright: at(publication, 'a clean tab resolves a publish conflict before retrying'),
    dom: [
      at(publicationDom, 'a clean tab resolves a publish conflict before retrying'),
    ],
    proves: [
      'the conflict notice replaces the generic error and keeps the saved status at conflict',
      'the publish control disables, Compare changes renders its baseline summary, and Use server version reports unavailable recovery without adopting the remote draft',
      'the refused publish carries the version and live generation this tab loaded',
    ],
    remainsBrowser: [
      'Compare changes must use the live BlockNote contenteditable snapshot; the DOM boundary supplies data without mounting that editor.',
      'Use server version exercises the browser IndexedDB recovery path; jsdom only asserts its unavailable-storage outcome.',
      'The native tail retries with the loaded then adopted version, publishes the adopted head, and observes the live link.',
    ],
  },
  {
    playwright: at(publication, 'a clean tab resolves a unpublish conflict before retrying'),
    dom: [
      at(publicationDom, 'a clean tab resolves a unpublish conflict before retrying'),
    ],
    proves: [
      'the conflict notice replaces the generic error and keeps the saved status at conflict',
      'the publish control disables, Compare changes renders its baseline summary, and Use server version reports unavailable recovery without adopting the remote draft',
      'the refused unpublish carries the version and live generation this tab loaded',
    ],
    remainsBrowser: [
      'Compare changes must use the live BlockNote contenteditable snapshot; the DOM boundary supplies data without mounting that editor.',
      'Use server version exercises the browser IndexedDB recovery path; jsdom only asserts its unavailable-storage outcome.',
      'The native tail retries with the loaded then adopted version and observes the live link disappear.',
    ],
  },
  {
    playwright: at(publication, 'the real Title field drives dirty status and saves corrected metadata'),
    dom: [
      at(publicationDom, 'publishing retains the save failure reason DOCUMENT_TOO_LARGE and permits correction'),
      at(publicationDom, 'publishing retains the save failure reason INVALID_DOCUMENT and permits correction'),
      at(publicationDom, 'publishing retains the save failure reason CONNECTION_FAILED and permits correction'),
    ],
    proves: [
      'the jsdom cases keep each declared save-failure reason, status and correction path at the controller/data boundary without claiming product Title field wiring.',
    ],
    remainsBrowser: [
      'the real Title field onChange drives dirty status through two successful autosaves, including a corrected title.',
    ],
  },
  {
    playwright: at(publication, 'publication explains every rejection at 1440px in en'),
    dom: [
      at(publicationDom, 'publication explains every rejection in en'),
    ],
    proves: [
      'the English publication heading and five ordered reasons render for the declared 422 response',
      'the raw PUBLICATION_INVALID and INVALID_DOCUMENT codes stay out of the notice',
      'the publish request carries the loaded version, live generation and head revision',
    ],
    remainsBrowser: ['the notice bounds are measured against the 1440px browser viewport.'],
  },
  {
    playwright: at(publication, 'publication explains every rejection at 1440px in zh'),
    dom: [
      at(publicationDom, 'publication explains every rejection in zh-CN'),
    ],
    proves: [
      'the Chinese publication heading and five ordered reasons render for the declared 422 response',
      'the raw PUBLICATION_INVALID and INVALID_DOCUMENT codes stay out of the notice',
      'the publish request carries the loaded version, live generation and head revision',
    ],
    remainsBrowser: ['the translated notice bounds are measured against the 1440px browser viewport.'],
  },
  {
    playwright: at(publication, 'publication explains every rejection at 320px in en'),
    dom: [
      at(publicationDom, 'publication explains every rejection in en'),
    ],
    proves: [
      'the English publication heading and five ordered reasons render for the declared 422 response',
      'the raw PUBLICATION_INVALID and INVALID_DOCUMENT codes stay out of the notice',
      'the publish request carries the loaded version, live generation and head revision',
    ],
    remainsBrowser: ['the notice and page horizontal overflow are measured at 320px.'],
  },
  {
    playwright: at(publication, 'publication explains every rejection at 320px in zh'),
    dom: [
      at(publicationDom, 'publication explains every rejection in zh-CN'),
    ],
    proves: [
      'the Chinese publication heading and five ordered reasons render for the declared 422 response',
      'the raw PUBLICATION_INVALID and INVALID_DOCUMENT codes stay out of the notice',
      'the publish request carries the loaded version, live generation and head revision',
    ],
    remainsBrowser: ['the translated notice and page horizontal overflow are measured at 320px.'],
  },
  {
    playwright: at(publication, 'publication rejection is revealed from the end of a long document at 1440px'),
    dom: [
      at(publicationDom, 'a refused publication renders its server error heading'),
    ],
    proves: ['a PUBLICATION_INVALID response renders the publication rejection heading and its server-provided reason'],
    remainsBrowser: [
      'the live BlockNote body scrolls beyond 1000px before publishing.',
      'the rejection notice receives native focus, remains in the viewport, and stays below the sticky header on both attempts.',
    ],
  },
  {
    playwright: at(publication, 'publication rejection is revealed from the end of a long document at 320px'),
    dom: [
      at(publicationDom, 'a refused publication renders its server error heading'),
    ],
    proves: ['a PUBLICATION_INVALID response renders the publication rejection heading and its server-provided reason'],
    remainsBrowser: [
      'the live BlockNote body scrolls beyond 1000px before publishing.',
      'the rejection notice receives native focus, remains in the viewport, and stays below the sticky header on both attempts.',
    ],
  },
  {
    playwright: at(schedule, 'failed schedule explanations fit the Chinese mobile drawer'),
    dom: [
      at(scheduleDom, 'failed schedule explanation renders in zh-CN'),
    ],
    proves: ['the Chinese failed-plan explanation renders for the declared failed item'],
    remainsBrowser: ['the drawer error and document are checked for horizontal overflow at 390px in a real browser.'],
  },
]

/** Execution boundaries for interpreting the publication DOM migration mapping. */
export const domGatePrerequisites: readonly string[] = [
  'Use the official `test:dom` config: jsdom runs the real React/client modules but has no layout, BlockNote editor, native focus delivery, or browser storage.',
  'Publication server replies are declared fixtures; these cases prove client rendering and requests, not stored version guards, schedule transitions, or public reader output.',
  '`publicationDomMigrations` records E2E → component → DOM lineage but is not integrated into the shared DOM registry by this work package.',
]
