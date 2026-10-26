/* eslint-disable style/max-len -- Verbatim case references stay on one line. */
import type { AdminMigrationRecord } from './admin-migrations'

/**
 * Where the retired reference browser cases now run.
 *
 * `legacy` names the E2E case that owned the assertions, `component` names the component
 * browser case that proves them on the production editor workspace (real settings drawer,
 * reference form, author list and DOI lookup over an explicit HTTP boundary), and `proves`
 * lists the original assertions that case covers. A case stays in E2E when only the routed
 * application can prove it: the reference copy stored by the Worker and read back after a
 * reload, a citation that lives in a table's body, the publish lock, and physical touch.
 *
 * Counts, per browser. The six reference E2E files ran 25 cases; 23 of them retire into 24
 * component cases declared below (references-form 5, references-authors 7, references-lookup 6,
 * references-layout 3, references-citations 2, references-publication 1). Two stay in E2E: one
 * store roundtrip at the drawer layout (down from 3 widths) and the CDP touch drag. `legacy`
 * lists the retained roundtrip as well, so `legacy` minus `retained` is the 23 retired cases.
 * The reference metadata request itself
 * (`GET /api/admin/reference-metadata`)
 * is server code and stays proved by `tests/unit/reference-metadata.test.ts` and the Worker
 * integration cases; these component cases prove what the form does with an answer.
 *
 * Control inventory: the `references` surface in `tests/support/browser/control-inventory.ts`
 * listed `references/reference-authors`, `references/reference-doi` and
 * `references/reference-author-page` as evidence. Those files are gone, and those entries now
 * name the component specs below, so the same controls stay obligations under the native plan.
 * `references/reference-settings` and `references/reference-drawer-page` still exist because
 * they still own retained cases.
 */

const authorsProves = [
  'a row is edited through its own page and the new name replaces that row only',
  'dragging the first row below the last reorders the list',
  'ArrowUp on the third handle moves it up, and the row menu moves and removes rows too',
  'pasting two names on separate lines adds both, trimmed',
  'the draft wrote nothing while it was open',
  'the author list does not overflow its column',
  'saving carries exactly those four authors and the draft reports itself saved',
]

const authorPageProves = [
  'opening the second author page keeps one dialog and starts in its name field',
  'Back to reference asks before discarding, Keep editing restores the value and its focus',
  'discarding returns focus to the author row and keeps the reference scroll position',
  'the parent reference title is still the typed draft after leaving the author page',
  'cancelling a new author page leaves the rows alone and returns focus to Add author',
  'saving an empty author reports the error and focuses the field',
]

const fieldsProve = [
  'an existing row is read-only and a cited reference cannot be removed, with its reason beside it',
  'a new draft starts empty with focus in the DOI field',
  'discarding a new draft writes nothing and returns focus to Add reference',
  'saving with no title and no authors reports the two required fields and focuses the title',
  'a fractional year, an invalid DOI and a javascript URL are reported together, each with its own label',
  'correcting them saves once, carrying the trimmed title, both authors, the year, the DOI and the URL',
  'the list then shows two rows with no editable input and no horizontal overflow',
  'editing keeps the reference id, and cancelling an edit writes nothing and returns focus to the row',
  'the form keeps its fields inside the dialog: Year and URL share a row above 600px and stack below it',
  'removing the created reference writes the document back to its cited reference only',
]

const tableProves = [
  'a reference cited from a table cell cannot be removed, with the reason beside it',
  'replacing the cell in the real table editor enables Remove',
  'the save carries the replaced cell text and a reference list that no longer holds the citation',
  'the list then drops the row',
]

const resizeProves = [
  'the author name typed at the start width survives a resize to the other layout',
  'Save stays in view and the page does not scroll horizontally at either width',
  'the author is committed without writing, then the reference saves once',
  'the saved draft carries the reference title and its one author',
  'each starting width settles into the layout its final width selects',
]

export const referenceMigrations: readonly AdminMigrationRecord[] = [
  {
    id: 'reference.drawer-page',
    legacy: [
      c('tests/browser/references/reference-drawer-page.spec.ts', 'reference pages share one drawer and restore settings at 320px'),
      c('tests/browser/references/reference-drawer-page.spec.ts', 'reference pages share one drawer and restore settings at 390px'),
    ],
    component: [
      {
        case: c('tests/components/specs/references-form.spec.ts', 'reference pages share one drawer and restore settings at 320px'),
        proves: [
          'the drawer is the only dialog and the reference editor is its page, not a second dialog',
          'the page starts in the DOI field and keeps Save in view',
          'Back to document settings restores the drawer heading, triggers focus and the list scroll position',
          'a changed draft asks before leaving, Keep editing restores the draft and its focus, Escape asks again',
          'discarding returns to the settings without writing, and Close shows the document body again',
        ],
      },
      {
        case: c('tests/components/specs/references-form.spec.ts', 'reference pages share one drawer and restore settings at 390px'),
        proves: ['the same drawer page holds at the wider phone width, including the accessibility scan'],
      },
    ],
    retained: [
      {
        cases: [
          c('tests/browser/references/reference-drawer-page.spec.ts', 'touch dragging sorts authors without dismissing the drawer'),
        ],
        reason: 'Physical touch dragging needs a Chromium CDP touch session, which only the E2E harness can open; the mouse and keyboard reorder it covers is proved on the component surface.',
      },
    ],
  },
  {
    id: 'reference.author-rows',
    legacy: [
      c('tests/browser/references/reference-authors.spec.ts', 'author rows edit, paste, reorder and persist at 320px'),
      c('tests/browser/references/reference-authors.spec.ts', 'author rows edit, paste, reorder and persist at 390px'),
      c('tests/browser/references/reference-authors.spec.ts', 'author rows edit, paste, reorder and persist at 1440px'),
    ],
    component: [
      {
        case: c('tests/components/specs/references-authors.spec.ts', 'native author drag, bounds and axe hold at 320px'),
        proves: authorsProves,
      },
      {
        case: c('tests/components/specs/references-authors.spec.ts', 'native author drag, bounds and axe hold at 390px'),
        proves: authorsProves,
      },
      {
        case: c('tests/components/specs/references-authors.spec.ts', 'native author drag, bounds and axe hold at 1440px'),
        proves: authorsProves,
      },
    ],
    retained: [],
  },
  {
    id: 'reference.author-limits',
    legacy: [
      c('tests/browser/references/reference-authors.spec.ts', 'author validation delivers native focus to required controls'),
    ],
    component: [
      {
        case: c('tests/components/specs/references-authors.spec.ts', 'author validation delivers native focus to required controls'),
        proves: [
          'saving without an author name focuses the author control instead of the title',
          'two authors with the same name stay two rows with their own identity',
          'an author name longer than 200 characters reports the limit and keeps the draft',
          'more than 50 names report the limit, and 50 names are accepted',
          'a list longer than five rows collapses to five and expands to all 50',
          'editing the second duplicate row changes only that row',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'reference.author-subpages',
    legacy: [
      c('tests/browser/references/reference-author-page.spec.ts', 'author subpages retain native focus, scroll and reachability at 320px'),
      c('tests/browser/references/reference-author-page.spec.ts', 'author subpages retain native focus, scroll and reachability at 390px'),
      c('tests/browser/references/reference-author-page.spec.ts', 'author subpages retain native focus, scroll and reachability at 1440px'),
    ],
    component: [
      {
        case: c('tests/components/specs/references-authors.spec.ts', 'author subpages retain native focus, scroll and reachability at 320px'),
        proves: authorPageProves,
      },
      {
        case: c('tests/components/specs/references-authors.spec.ts', 'author subpages retain native focus, scroll and reachability at 390px'),
        proves: authorPageProves,
      },
      {
        case: c('tests/components/specs/references-authors.spec.ts', 'author subpages retain native focus, scroll and reachability at 1440px'),
        proves: authorPageProves,
      },
    ],
    retained: [],
  },
  {
    id: 'reference.fields-validate',
    legacy: [
      c('tests/browser/references/reference-settings.spec.ts', 'reference drafts save explicitly and keep cited records intact at 320px'),
      c('tests/browser/references/reference-settings.spec.ts', 'reference drafts save explicitly and keep cited records intact at 390px'),
      c('tests/browser/references/reference-settings.spec.ts', 'reference drafts save explicitly and keep cited records intact at 1440px'),
    ],
    component: [
      {
        case: c('tests/components/specs/references-form.spec.ts', 'reference form geometry and focus return hold at 320px'),
        proves: fieldsProve,
      },
      {
        case: c('tests/components/specs/references-form.spec.ts', 'reference form geometry and focus return hold at 390px'),
        proves: fieldsProve,
      },
      {
        case: c('tests/components/specs/references-form.spec.ts', 'reference form geometry and focus return hold at 1440px'),
        proves: fieldsProve,
      },
    ],
    retained: [
      {
        cases: [
          c('tests/browser/references/reference-settings.spec.ts', 'reference drafts save explicitly and keep cited records intact at 390px'),
        ],
        reason: 'The stored copy is the point: the reference a case creates and renames is read back from the Worker, removing it restores the cited fixture exactly, and the reloaded document still shows its citation. One width at the drawer layout keeps that proof; the 320 and 1440 executions retire into the component cases above, which cover all three widths and the side panel layout.',
      },
    ],
  },
  {
    id: 'reference.doi-lookup',
    legacy: [
      c('tests/browser/references/reference-doi.spec.ts', 'DOI lookup preserves manual entries and saves explicitly at 320px'),
      c('tests/browser/references/reference-doi.spec.ts', 'DOI lookup preserves manual entries and saves explicitly at 390px'),
      c('tests/browser/references/reference-doi.spec.ts', 'DOI lookup preserves manual entries and saves explicitly at 1440px'),
    ],
    component: [],
    retained: [],
  },
  {
    id: 'reference.doi-failures',
    legacy: [
      c('tests/browser/references/reference-doi.spec.ts', 'failed and partial DOI lookups leave manual creation available'),
    ],
    component: [
      {
        case: c('tests/components/specs/references-lookup.spec.ts', 'failed and partial DOI lookups leave manual creation available'),
        proves: [
          'a DOI that cannot be parsed is reported without a request reaching the server',
          'a DOI the server does not know reports that no information was found',
          'a partial answer reports the missing information and leaves the empty fields empty',
          'manual entries still create a draft, and discarding it writes nothing',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'reference.doi-delayed',
    legacy: [
      c('tests/browser/references/reference-doi.spec.ts', 'changing DOI and closing the dialog prevents delayed metadata from altering a new draft'),
    ],
    component: [
      {
        case: c('tests/components/specs/references-lookup.spec.ts', 'changing DOI and closing the dialog prevents delayed metadata from altering a new draft'),
        proves: [
          'a lookup in flight disables Save and reports Retrieving…',
          'an answer that arrives after the DOI changed leaves the newer draft untouched',
          'discarding and reopening starts from an empty DOI and title',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'reference.doi-pending-author',
    legacy: [
      c('tests/browser/references/reference-doi.spec.ts', 'DOI lookup keeps an author typed while the request is pending'),
    ],
    component: [
      {
        case: c('tests/components/specs/references-lookup.spec.ts', 'DOI lookup keeps an author typed while the request is pending'),
        proves: [
          'an author typed while the lookup is in flight survives the answer',
          'that author is the one the saved draft carries',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'reference.resize-drafts',
    legacy: [
      c('tests/browser/references/reference-boundaries.spec.ts', 'reference and author drafts survive resizing from 1024px'),
      c('tests/browser/references/reference-boundaries.spec.ts', 'reference and author drafts survive resizing from 1366px'),
    ],
    component: [
      {
        case: c('tests/components/specs/references-layout.spec.ts', 'reference and author drafts survive resizing from 1024px'),
        proves: resizeProves,
      },
      {
        case: c('tests/components/specs/references-layout.spec.ts', 'reference and author drafts survive resizing from 1366px'),
        proves: resizeProves,
      },
    ],
    retained: [],
  },
  {
    id: 'reference.drawer-resize',
    legacy: [
      c('tests/browser/references/reference-boundaries.spec.ts', 'a settings drawer closed by resizing does not reopen on returning to mobile'),
    ],
    component: [],
    retained: [],
  },
  {
    id: 'reference.cited-table-guards',
    legacy: [
      c('tests/browser/references/reference-boundaries.spec.ts', 'editing a native table citation unlocks removal (array)'),
      c('tests/browser/references/reference-boundaries.spec.ts', 'editing a native table citation unlocks removal (structured)'),
    ],
    component: [
      {
        case: c('tests/components/specs/references-citations.spec.ts', 'editing a native table citation unlocks removal (array)'),
        proves: tableProves,
      },
      {
        case: c('tests/components/specs/references-citations.spec.ts', 'editing a native table citation unlocks removal (structured)'),
        proves: tableProves,
      },
    ],
    retained: [],
  },
  {
    id: 'reference.publication-lock',
    legacy: [
      c('tests/browser/references/reference-boundaries.spec.ts', 'publication keeps reference mutations disabled until its response arrives'),
    ],
    component: [
      {
        case: c('tests/components/specs/references-publication.spec.ts', 'published live link waits for a matching document revision read'),
        proves: [
          'an unused reference offers Add, Edit and Remove',
          'while the publish request is held every one of them is disabled',
          'releasing the publish answer shows the live link and re-enables them',
        ],
      },
    ],
    retained: [],
  },
]

function c(file: string, title: string): string {
  return `${file} :: ${title}`
}
