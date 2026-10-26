/* eslint-disable style/max-len -- Verbatim registered Playwright titles stay on one line. */
/**
 * References browser proof split by evidence layer.
 *
 * Lineage: the Worker-backed `reference-settings` E2E round-trip feeds the
 * component form case and then its jsdom successor; the CDP touch-drag E2E is
 * complemented by the component mouse-drag cases and the author-state DOM cases.
 * Each component row below names the jsdom successor for its form/state
 * assertions; `remainsBrowser` names only the native fact still owned there.
 *
 * This is data, not a test. The companion
 * `tests/contracts/references-dom-migrations.ts` holds the checked legacy keys
 * and jsdom successors for integration into the shared DOM migration ledger.
 */

export type ReferencesDomRetirement = {
  /** The registered Playwright case key, `file :: title`. */
  readonly playwright: string
  /** Exact jsdom cases that now prove its form or state assertions. */
  readonly dom: readonly string[]
  /** Original assertions now proved by those jsdom cases. */
  readonly proves: readonly string[]
  /** Material native assertions that still require a browser engine. */
  readonly remainsBrowser: readonly string[]
}

function at(file: string, title: string): string {
  return `${file} :: ${title}`
}

const authors = 'tests/components/specs/references-authors.spec.ts'
const citations = 'tests/components/specs/references-citations.spec.ts'
const form = 'tests/components/specs/references-form.spec.ts'
const layout = 'tests/components/specs/references-layout.spec.ts'
const lookup = 'tests/components/specs/references-lookup.spec.ts'
const publication = 'tests/components/specs/references-publication.spec.ts'
const e2eSettings = 'tests/browser/references/reference-settings.spec.ts'
const e2eTouch = 'tests/browser/references/reference-drawer-page.spec.ts'
const authorsDom = 'tests/dom/references-authors.test.tsx'
const citationsDom = 'tests/dom/references-citations.test.tsx'
const formDom = 'tests/dom/references-form.test.tsx'
const lookupDom = 'tests/dom/references-lookup.test.tsx'
const publicationDom = 'tests/dom/references-publication.test.tsx'
const widths = [
  320,
  390,
  1440,
]
const compactWidths = [320, 390]

const compactAuthorRows = at(authorsDom, 'edits, reorders, pastes and saves author rows at 390px')
const wideAuthorRows = at(authorsDom, 'edits, reorders, pastes and saves author rows at 1440px')
const authorLimits = at(authorsDom, 'enforces author limits while preserving duplicate rows and their identities')
const authorSubpages = at(authorsDom, 'preserves a reference draft while an author subpage is edited and discarded')
const referencePages = at(formDom, 'keeps reference page edits local until the draft is discarded')
const referenceFormState = at(formDom, 'validates reference fields and saves a draft without removing its cited record')
const lookupFailures = at(lookupDom, 'keeps manual creation available after invalid, missing and partial DOI results')
const lookupRace = at(lookupDom, 'ignores a delayed lookup after the DOI changes and the draft is closed')
const lookupPendingAuthor = at(lookupDom, 'preserves an author entered while the metadata request is pending')
const publicationState = at(publicationDom, 'locks reference mutations while publishing and unlocks them after the response')

export const referencesDomRetirements: readonly ReferencesDomRetirement[] = [
  ...widths.map((width): ReferencesDomRetirement => ({
    playwright: at(authors, `native author drag, bounds and axe hold at ${width}px`),
    dom: [
      width < 1100 ? compactAuthorRows : wideAuthorRows,
    ],
    proves: [
      'editing an author updates its row without changing the list identity',
      'keyboard reorder and the responsive row actions produce the declared author order',
      'multiline paste trims empty lines and surrounding whitespace into separate authors',
      'author edits remain a local draft until Save and the revision packet carries the edited list',
    ],
    remainsBrowser: [
      `the real mouse drag handle reorders author rows at ${width}px; CSS overflow bounds, Save-button viewport reachability and axe require the browser layout and accessibility tree`,
    ],
  })),
  {
    playwright: at(authors, 'author validation delivers native focus to required controls'),
    dom: [authorLimits],
    proves: [
      'a 201-character author is rejected without mutating the current rows',
      'the 50-author limit is enforced, and Show fewer / Show all expose five / fifty rows',
      'editing one duplicate preserves the other row and the save packet keeps both identities in order',
    ],
    remainsBrowser: [
      'native focus lands on Add author when the required list is empty and on the author input after a rejected long paste',
    ],
  },
  ...widths.map((width): ReferencesDomRetirement => ({
    playwright: at(authors, `author subpages retain native focus, scroll and reachability at ${width}px`),
    dom: [authorSubpages, referencePages],
    proves: [
      'the author subpage edits and discards its own draft while preserving the parent reference title and author rows',
      'only one reference dialog is rendered; returning from the author subpage preserves the parent draft',
      'adding and cancelling an author and discarding a reference draft write nothing; a new reference starts empty',
    ],
    remainsBrowser: [
      `the real editor settings drawer / side-panel branch at ${width}px restores native focus and scroll, keeps the nested modal in viewport, and passes axe against computed styles`,
    ],
  })),
  {
    playwright: at(citations, 'editing a native table citation unlocks removal (array)'),
    dom: [
      at(citationsDom, 'keeps a reference cited by array table cells disabled'),
    ],
    proves: [
      'an array-encoded table citation disables Remove reference and shows the literal citation warning without a write',
    ],
    remainsBrowser: [
      'editing the actual BlockNote table cell uses native contenteditable selection; after that real edit the guard unlocks and the save packet contains the replaced cell and removed reference',
    ],
  },
  {
    playwright: at(citations, 'editing a native table citation unlocks removal (structured)'),
    dom: [
      at(citationsDom, 'keeps a reference cited by structured tableCell nodes disabled'),
    ],
    proves: [
      'a structured tableCell citation disables Remove reference and shows the literal citation warning without a write',
    ],
    remainsBrowser: [
      'editing the actual BlockNote table cell uses native contenteditable selection; after that real edit the guard unlocks and the save packet contains the replaced cell and removed reference',
    ],
  },
  ...compactWidths.map((width): ReferencesDomRetirement => ({
    playwright: at(form, `reference pages share one drawer and restore settings at ${width}px`),
    dom: [referencePages],
    proves: [
      'the reference and author pages share one logical reference draft; leaving and returning does not commit it',
      'a discarded author edit leaves the parent reference unchanged, and cancelling the parent writes nothing',
    ],
    remainsBrowser: [
      `the actual compact SettingsDrawer contains the reference page as its only modal at ${width}px, returns native focus to the list, restores the measured scroll position and passes axe`,
    ],
  })),
  ...widths.map((width): ReferencesDomRetirement => ({
    playwright: at(form, `reference form geometry and focus return hold at ${width}px`),
    dom: [referenceFormState],
    proves: [
      'an empty submit reports both required title and authors errors without a write',
      'invalid year, DOI and URL values produce three field errors and no revision write',
      'corrected values, trimmed title and normalized author rows appear in the real save packet',
      'editing preserves the reference id, cancelling writes nothing, and removing the new item keeps the original cited record',
    ],
    remainsBrowser: [
      `the real reference dialog fits ${width}px with measured responsive fields and axe against computed styles; native focus lands on the title after invalid submit, on the title when editing, and returns to the opening trigger after Save and Cancel`,
    ],
  })),
  {
    playwright: at(layout, 'reference and author drafts survive resizing from 1024px'),
    dom: [],
    proves: [],
    remainsBrowser: [
      'the real EditorSettings compact-to-wide viewport transition keeps the open reference and author pages mounted, with measured page overflow and Save reachability across the breakpoint',
    ],
  },
  {
    playwright: at(layout, 'reference and author drafts survive resizing from 1366px'),
    dom: [],
    proves: [],
    remainsBrowser: [
      'the real EditorSettings wide-to-compact viewport transition keeps the open reference and author pages mounted, with measured page overflow and Save reachability across the breakpoint',
    ],
  },
  {
    playwright: at(publication, 'published live link waits for a matching document revision read'),
    dom: [publicationState],
    proves: [
      'the DOM header renders the supplied livePath prop as its href; it does not exercise production useLivePath wiring',
      'Add, Edit and Remove lock until the publish response arrives and then become available',
    ],
    remainsBrowser: [
      'the production editor waits for the document GET after an acknowledgement, withholds the link for a mismatched liveRevisionId, and shows the returned path only when the revision matches',
    ],
  },
  {
    playwright: at(lookup, 'failed and partial DOI lookups leave manual creation available'),
    dom: [lookupFailures],
    proves: [
      'an invalid DOI issues no request; a 404 and partial schema-valid response leave manual entry available',
      'the partial reply fills its declared DOI and URL while leaving title, authors and year empty; cancelling writes nothing',
    ],
    remainsBrowser: [],
  },
  {
    playwright: at(lookup, 'changing DOI and closing the dialog prevents delayed metadata from altering a new draft'),
    dom: [lookupRace],
    proves: [
      'a held metadata reply does not overwrite manually entered title after the DOI changes',
      'closing the old draft and opening a new one keeps the new fields empty after the old response resolves',
      'the delayed lookup path writes nothing',
    ],
    remainsBrowser: [],
  },
  {
    playwright: at(lookup, 'DOI lookup keeps an author typed while the request is pending'),
    dom: [lookupPendingAuthor],
    proves: [
      'the Save action stays disabled while lookup is pending but the author subpage accepts a manual author',
      'the parsed response preserves the manually entered author and the final revision packet carries it',
    ],
    remainsBrowser: [],
  },
  {
    playwright: at(e2eSettings, 'reference drafts save explicitly and keep cited records intact at 390px'),
    dom: [referenceFormState],
    proves: [
      'the client creates, edits and removes a reference while preserving the original cited record in the request packets',
    ],
    remainsBrowser: [
      'the Worker persists each reference mutation and the final document / citation survives the routed application reload',
    ],
  },
  {
    playwright: at(e2eTouch, 'touch dragging sorts authors without dismissing the drawer'),
    dom: [compactAuthorRows],
    proves: [
      'author names and list ordering have a DOM successor; the jsdom successor does not claim a physical touch gesture',
    ],
    remainsBrowser: [
      'Chromium CDP dispatches the real touchStart / touchMove / touchEnd drag and verifies the drawer remains open after the gesture',
    ],
  },
]

/** Boundaries the DOM migration ledger must retain when it incorporates this module. */
export const domGatePrerequisites: readonly string[] = [
  'Use the official `test:dom` config; its `next/link` and `next/navigation` host adapters do not prove routing or hydration.',
  '`references-support.tsx` uses schema-built document data and the production reference controller/client/i18n; its BlockNote lifecycle boundary proves no contenteditable editor behavior.',
  'Do not claim actual table-cell editing, pointer/touch dragging, CSS bounds, painted size, computed-style axe results, routed Worker persistence or reload survival from jsdom.',
  'The two reference/author draft-resize cases remain in Playwright for live geometry; the closed-drawer resize behavior is exercised with the real EditorSettings and a declared host media query in jsdom.',
]
