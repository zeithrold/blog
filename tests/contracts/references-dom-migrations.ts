/* eslint-disable style/max-len -- Keep each exact migration key readable on one line. */
import type { DomMigrationRecord } from './dom-migrations'

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
const layoutDom = 'tests/dom/references-layout.test.tsx'
const lookupDom = 'tests/dom/references-lookup.test.tsx'
const publicationDom = 'tests/dom/references-publication.test.tsx'
const widths = [
  320,
  390,
  1440,
]
const compactWidths = [320, 390]

const compactRows = at(authorsDom, 'edits, reorders, pastes and saves author rows at 390px')
const wideRows = at(authorsDom, 'edits, reorders, pastes and saves author rows at 1440px')
const authorLimits = at(authorsDom, 'enforces author limits while preserving duplicate rows and their identities')
const authorSubpages = at(authorsDom, 'preserves a reference draft while an author subpage is edited and discarded')
const referencePages = at(formDom, 'keeps reference page edits local until the draft is discarded')
const formState = at(formDom, 'validates reference fields and saves a draft without removing its cited record')
const lookupSuccess = at(lookupDom, 'fills empty fields from the parsed lookup and keeps manually curated values')
const lookupFailures = at(lookupDom, 'keeps manual creation available after invalid, missing and partial DOI results')
const lookupRace = at(lookupDom, 'ignores a delayed lookup after the DOI changes and the draft is closed')
const lookupAuthor = at(lookupDom, 'preserves an author entered while the metadata request is pending')
const publicationState = at(publicationDom, 'locks reference mutations while publishing and unlocks them after the response')

function domCase(caseKey: string, proves: readonly string[]) {
  return { case: caseKey, contracts: [], proves }
}

/**
 * Contract successors for integration into `domMigrations`.
 * The `contracts` arrays are intentionally empty: References has no contract-id
 * table, so these records only establish exact case lineage and retained reasons.
 */
export const referencesDomMigrations: readonly DomMigrationRecord[] = [
  {
    id: 'references.authors',
    legacy: [
      at(e2eTouch, 'touch dragging sorts authors without dismissing the drawer'),
      ...widths.map(width => at(authors, `native author drag, bounds and axe hold at ${width}px`)),
      at(authors, 'author validation delivers native focus to required controls'),
    ],
    dom: [
      domCase(compactRows, [
        'author edits, keyboard order, compact menu actions and multiline paste produce the expected rows',
        'the reference draft stays local until Save and the real revision packet carries the authors',
      ]),
      domCase(wideRows, [
        'author edits, keyboard order, wide row actions and multiline paste produce the expected rows',
        'the reference draft stays local until Save and the real revision packet carries the authors',
      ]),
      domCase(authorLimits, [
        'a 201-character author and an attempted 51st author are refused without changing the current list',
        'the five-row expansion and fifty-row full list preserve duplicate rows',
        'editing one duplicate leaves the other unchanged in the save packet',
      ]),
    ],
    retained: [
      {
        cases: [
          at(e2eTouch, 'touch dragging sorts authors without dismissing the drawer'),
          ...widths.map(width => at(authors, `native author drag, bounds and axe hold at ${width}px`)),
        ],
        reason: 'Split: jsdom proves author values, keyboard/menu ordering, paste, and save packets; Playwright keeps physical mouse/touch dragging, viewport bounds, in-viewport controls, the actual editor drawer and axe.',
      },
      {
        cases: [
          at(authors, 'author validation delivers native focus to required controls'),
        ],
        reason: 'Split: jsdom proves limits, expansion and duplicate identity; this component case keeps the native focus delivery to Add author and the invalid author input.',
      },
    ],
  },
  {
    id: 'references.editor-pages',
    legacy: [
      ...widths.map(width => at(authors, `author subpages retain native focus, scroll and reachability at ${width}px`)),
      ...compactWidths.map(width => at(form, `reference pages share one drawer and restore settings at ${width}px`)),
    ],
    dom: [
      domCase(authorSubpages, [
        'the nested author subpage edits and discards independently while preserving its parent reference draft',
        'the reference author list and parent title remain unchanged after discarding the subpage edit',
        'the reference-level discard writes nothing',
      ]),
      domCase(referencePages, [
        'reference and author page edits remain local until the parent draft is discarded',
        'a new author can be added, an empty author is refused, and cancelling does not mutate the parent list',
        'reopening Add reference starts with empty title and author rows',
      ]),
    ],
    retained: [
      {
        cases: [
          ...widths.map(width => at(authors, `author subpages retain native focus, scroll and reachability at ${width}px`)),
          ...compactWidths.map(width => at(form, `reference pages share one drawer and restore settings at ${width}px`)),
        ],
        reason: 'Split: jsdom proves nested reference/author draft state; the browser cases keep the real settings drawer/side-panel branch, native focus return, scroll restoration, measured modal reachability and axe against computed styles.',
      },
    ],
  },
  {
    id: 'references.citations',
    legacy: [
      at(citations, 'editing a native table citation unlocks removal (array)'),
      at(citations, 'editing a native table citation unlocks removal (structured)'),
    ],
    dom: [
      domCase(at(citationsDom, 'keeps a reference cited by array table cells disabled'), [
        'an array-encoded table citation disables removal and gives the literal warning with no write',
      ]),
      domCase(at(citationsDom, 'keeps a reference cited by structured tableCell nodes disabled'), [
        'a structured tableCell citation disables removal and gives the literal warning with no write',
      ]),
    ],
    retained: [
      {
        cases: [
          at(citations, 'editing a native table citation unlocks removal (array)'),
          at(citations, 'editing a native table citation unlocks removal (structured)'),
        ],
        reason: 'Split: jsdom proves the initial cited-reference guard in both stored cell shapes; Playwright keeps editing the real BlockNote contenteditable cell, its native selection, the resulting unlock and the serialized table save.',
      },
    ],
  },
  {
    id: 'references.form',
    legacy: [
      at(e2eSettings, 'reference drafts save explicitly and keep cited records intact at 390px'),
      ...widths.map(width => at(form, `reference form geometry and focus return hold at ${width}px`)),
    ],
    dom: [
      domCase(formState, [
        'an empty submission reports both required title and authors errors and sends no write',
        'the form validates year, DOI and URL and sends no invalid write',
        'the corrected title, authors, year, DOI and URL are present in the real revision packet',
        'editing retains a reference id, cancelling it writes nothing, and removing the new item preserves the cited record',
      ]),
    ],
    retained: [
      {
        cases: [
          at(e2eSettings, 'reference drafts save explicitly and keep cited records intact at 390px'),
        ],
        reason: 'The routed E2E remains for Worker-backed persistence after each write, the stored citation/body, and the read-back after reload; those are outside the component and jsdom boundaries.',
      },
      {
        cases: [
          ...widths.map(width => at(form, `reference form geometry and focus return hold at ${width}px`)),
        ],
        reason: 'Split: jsdom proves validation and saved packet state; Playwright keeps measured dialog geometry, computed-style axe, native title focus after invalid submit and edit, and focus return after Save and Cancel.',
      },
    ],
  },
  {
    id: 'references.lookup',
    legacy: [
      ...widths.map(width => at(lookup, `DOI lookup fills empty fields and keeps a curated draft at ${width}px`)),
      at(lookup, 'failed and partial DOI lookups leave manual creation available'),
      at(lookup, 'changing DOI and closing the dialog prevents delayed metadata from altering a new draft'),
      at(lookup, 'DOI lookup keeps an author typed while the request is pending'),
    ],
    dom: [
      domCase(lookupSuccess, [
        'the real metadata schema parses transport replies, fills empty fields, and preserves curated values on a second lookup',
        'the final request packet carries the manually curated title, authors and URL',
      ]),
      domCase(lookupFailures, [
        'invalid DOI input sends no request, and failed / partial replies preserve manual creation',
        'the partial reply fills only the declared transport fields and cancellation sends no write',
      ]),
      domCase(lookupRace, [
        'changing DOI prevents a delayed response from altering the edited draft, and a newly opened draft stays empty',
      ]),
      domCase(lookupAuthor, [
        'a manually entered author survives a held, schema-parsed lookup and appears in the final packet',
      ]),
    ],
    retained: [],
  },
  {
    id: 'references.publication',
    legacy: [
      at(publication, 'published live link waits for a matching document revision read'),
    ],
    dom: [
      domCase(publicationState, [
        'real publication actions lock Add, Edit and Remove while the response is held and unlock them after the acknowledgement',
        'the DOM header renders its supplied livePath prop as the href; this is presentation-only and does not exercise production useLivePath wiring',
      ]),
    ],
    retained: [
      {
        cases: [
          at(publication, 'published live link waits for a matching document revision read'),
        ],
        reason: 'The production editor case proves ACK → document GET → revision matching: a mismatched read keeps the link absent, and the matching read reveals its returned path.',
      },
    ],
  },
  {
    id: 'references.settings-layout',
    legacy: [
      at(layout, 'a settings drawer closed by resizing does not reopen on returning to mobile'),
    ],
    dom: [
      domCase(at(layoutDom, 'closes the compact settings drawer on resize and keeps it closed on return'), [
        'the real EditorSettings opens the compact drawer and a wide host media declaration moves it to the side panel',
        'returning the host media declaration to compact leaves the drawer closed and performs no write',
      ]),
    ],
    retained: [],
  },
]
