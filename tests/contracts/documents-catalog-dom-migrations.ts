/* eslint-disable max-lines, style/max-len, ztd/array-layout, antfu/consistent-list-newline -- Declarative migration rows stay grouped by lineage. */
import type { DomMigrationRecord } from './dom-migrations'

const files = {
  documentsList: 'tests/components/specs/documents-list.spec.ts',
  documentsBoundaries: 'tests/components/specs/documents-boundaries.spec.ts',
  documentsChips: 'tests/components/specs/documents-chips.spec.ts',
  documentsLoading: 'tests/components/specs/documents-loading.spec.ts',
  documentsReadiness: 'tests/components/specs/documents-readiness.spec.ts',
  documentsA11y: 'tests/components/specs/documents-a11y.spec.ts',
  catalogManager: 'tests/components/specs/catalog-manager.spec.ts',
  catalogControls: 'tests/components/specs/catalog-controls.spec.ts',
  catalogA11y: 'tests/components/specs/catalog-a11y.spec.ts',
  browserDocumentsBoundaries: 'tests/browser/documents/document-list-boundaries.spec.ts',
  browserDocumentsHydration: 'tests/browser/documents/document-list-hydration.spec.ts',
  browserDocumentsReadiness: 'tests/browser/documents/document-list-readiness.spec.ts',
  browserCatalogBoundaries: 'tests/browser/catalog/catalog-boundaries.spec.ts',
  browserCatalogA11y: 'tests/browser/catalog/catalog-boundary-a11y.spec.ts',
  browserCatalogNavigation: 'tests/browser/catalog/catalog-navigation.spec.ts',
  documentsListDom: 'tests/dom/documents-list.test.tsx',
  documentsBoundariesDom: 'tests/dom/documents-boundaries.test.tsx',
  documentsChipsDom: 'tests/dom/documents-chips.test.tsx',
  documentsLoadingDom: 'tests/dom/documents-loading.test.tsx',
  documentsReadinessDom: 'tests/dom/documents-readiness.test.tsx',
  documentsA11yDom: 'tests/dom/documents-a11y.test.tsx',
  catalogManagerDom: 'tests/dom/catalog-manager.test.tsx',
  catalogControlsDom: 'tests/dom/catalog-controls.test.tsx',
  catalogA11yDom: 'tests/dom/catalog-a11y.test.tsx',
} as const

function at(file: string, title: string): string {
  return `${file} :: ${title}`
}

type ContractId = NonNullable<DomMigrationRecord['dom'][number]['contracts']>[number]

function dom(
  file: string,
  title: string,
  contracts: readonly ContractId[],
  proves: readonly string[],
): DomMigrationRecord['dom'][number] {
  return { case: at(file, title), contracts, proves }
}

const documentsList = files.documentsList
const documentsBoundaries = files.documentsBoundaries
const documentsChips = files.documentsChips
const documentsLoading = files.documentsLoading
const documentsReadiness = files.documentsReadiness
const documentsA11y = files.documentsA11y
const catalogManager = files.catalogManager
const catalogControls = files.catalogControls
const catalogA11y = files.catalogA11y

/**
 * Second-generation migrations from component browser cases to jsdom.
 *
 * E2E keys appear only where an existing E2E case shares assertions with these
 * successors. Such keys stay in `retained` for their real native route, SSR or
 * Worker/D1 proof; they are never retired by this module.
 */
export const documentsCatalogDomMigrations: readonly DomMigrationRecord[] = [
  {
    id: 'documents.component-list',
    legacy: [
      at(documentsList, 'a failed first load offers Try again and the retry renders the list'),
      at(documentsList, 'removing the search chip returns native focus to the search field'),
      at(documentsList, 'clearing filters restores the unfiltered list'),
      at(documentsList, 'rows render the draft, published and changed badges'),
      at(documentsList, 'trash rows restore to drafts and leave the trash list'),
      at(documentsList, 'Chinese filter bar stays inside the 320px viewport'),
    ],
    dom: [
      dom(files.documentsListDom, 'a failed first load offers Try again and the retry renders the list',
        ['documents.list-load-recovery', 'documents.page-rendering'], [
          'the refused first load renders the load alert and Try again control',
          'retry clears the alert and renders the returned document row',
        ]),
      dom(files.documentsListDom, 'filters narrow the list and their chips remove individually',
        ['documents.list-form-wiring', 'documents.page-rendering'], [
          'search, kind and publication state combine to show the matching document',
          'each active chip names its own filter and removing a chip resets that filter',
          'removing the search chip clears its value while preserving the remaining filters',
        ]),
      dom(files.documentsListDom, 'clearing filters restores the unfiltered list',
        ['documents.list-form-wiring'], [
          'a non-matching search renders the no-matches copy and no document links',
          'Clear filters resets the search and kind controls and restores the served rows',
        ]),
      dom(files.documentsListDom, 'rows render the draft, published and changed badges',
        ['documents.page-rendering'], [
          'one row renders per returned entry',
          'draft, published and changed entries render their respective data-state and localized badge copy',
          'the row kind remains separate from the publication badge',
        ]),
      dom(files.documentsListDom, 'trash rows restore to drafts and leave the trash list',
        ['documents.restore-notices', 'documents.restore-state', 'documents.page-rendering'], [
          'trash rows render as text with a restore control described by the row title',
          'restoring sends the listed document id and expected version and removes the trash row',
          'the same document id returns as a draft link after changing the list filter',
        ]),
      dom(files.documentsListDom, 'Chinese labels render in the compact viewport',
        ['documents.list-form-wiring'], [
          'the heading, search, filter controls and create action render with the Chinese copy',
          'choosing the draft state displays the selected Chinese value',
        ]),
    ],
    retained: [
      {
        cases: [at(documentsList, 'removing the search chip returns native focus to the search field')],
        reason: 'The DOM case proves filter and chip state; this browser case retains native focus delivery to the cleared search field.',
      },
      {
        cases: [at(documentsList, 'Chinese filter bar stays inside the 320px viewport')],
        reason: 'The DOM case proves Chinese copy and selected state; this browser case retains measured 320px page overflow.',
      },
    ],
  },
  {
    id: 'documents.component-boundaries',
    legacy: [
      at(documentsBoundaries, 'pagination failure alert receives native focus'),
      at(documentsBoundaries, 'failed refresh alert stays in bounds and receives native focus'),
      at(documentsBoundaries, 'restore notices keep their bounds in Chinese at 320px'),
      at(documentsBoundaries, 'restored status receives native focus after retry'),
      at(documentsBoundaries, 'a restore conflict refreshes the list before another attempt'),
      at(files.browserDocumentsBoundaries, 'trash retries a lost restoration response without restoring twice'),
    ],
    dom: [
      dom(files.documentsBoundariesDom, 'pagination retries the same cursor and merges without duplicate rows',
        ['documents.list-pagination-ui', 'documents.list-more-retry'], [
          'a refused page keeps the first 50 rows and renders the next-page alert',
          'retry requests the same cursor and merges the second page without a duplicate row',
          'the completed page removes Load more',
        ]),
      dom(files.documentsBoundariesDom, 'a confirmed restore survives a failed refresh and preserves the list state',
        ['documents.restore-notices', 'documents.restore-version', 'documents.restore-state'], [
          'a confirmed restore removes the trash row while the following list read is pending',
          'the in-flight refresh holds the sibling restore control and preserves unsubmitted search text',
          'a refused refresh keeps the committed restore status beside the load alert',
          'retry clears the alert without losing the unsubmitted query or Trash filter',
          'the restore request carries the listed document id and expected version',
        ]),
      dom(files.documentsBoundariesDom, 'Chinese restore notices render in the compact viewport',
        ['documents.restore-notices'], [
          'the Chinese failed-refresh alert and committed status render together',
        ]),
      dom(files.documentsBoundariesDom, 'a lost restore response retries with the same idempotency key',
        ['documents.restore-key', 'documents.restore-notices', 'documents.mutation-outcome'], [
          'a lost response is reported as an unconfirmed restore',
          'retry repeats the same restore route, expected-version body and non-empty idempotency key',
          'the acknowledged retry removes the row and renders the restored status',
        ]),
      dom(files.documentsBoundariesDom, 'a restore conflict refreshes before another attempt',
        ['documents.restore-conflict', 'documents.restore-conflict-notices'], [
          'a conflict names the changed document and offers a refresh',
          'Refresh list answers the conflict without repeating the refused write',
          'a later explicit restore makes one new write and removes the row',
        ]),
    ],
    retained: [
      {
        cases: [
          at(documentsBoundaries, 'pagination failure alert receives native focus'),
        ],
        reason: 'The DOM case proves cursor reuse and row merging; this browser case retains native alert focus and viewport placement.',
      },
      {
        cases: [
          at(documentsBoundaries, 'failed refresh alert stays in bounds and receives native focus'),
        ],
        reason: 'The DOM case proves restore and retry state; this browser case retains alert focus, panel bounds and desktop/tablet geometry.',
      },
      {
        cases: [
          at(documentsBoundaries, 'restore notices keep their bounds in Chinese at 320px'),
        ],
        reason: 'The DOM case proves the Chinese notices; this browser case retains measured restore-control and alert bounds at 320px.',
      },
      {
        cases: [
          at(documentsBoundaries, 'restored status receives native focus after retry'),
        ],
        reason: 'The DOM case proves the keyed retry; this browser case retains native focus delivery to the restored status.',
      },
      {
        cases: [
          at(files.browserDocumentsBoundaries, 'trash retries a lost restoration response without restoring twice'),
        ],
        reason: 'The DOM case proves the client request replay; the E2E case retains the real D1 version readback proving one committed restore.',
      },
    ],
  },
  {
    id: 'documents.component-chips-hydration',
    legacy: [
      at(files.browserDocumentsHydration, 'the search form stays disabled until hydration and opens before the list answers'),
      at(documentsChips, '120-character en search chip ellipsizes and returns native focus at 320px'),
      at(documentsChips, '120-character zh search chip ellipsizes and returns native focus at 320px'),
      at(documentsLoading, 'English first-load and refresh indicator geometry survives reduced motion at 1440px'),
    ],
    dom: [
      dom(files.documentsChipsDom, '120-character en search chip is named and removable',
        ['documents.list-chip-layout'], [
          'the submitted 120-character search appears in a chip with its independently expected accessible name',
          'removing the chip clears the search draft and removes the active filter',
        ]),
      dom(files.documentsChipsDom, '120-character zh search chip is named and removable',
        ['documents.list-chip-layout'], [
          'the submitted 120-character Chinese search appears in a chip with its independently expected accessible name',
          'removing the chip clears the search draft and removes the active filter',
        ]),
      dom(files.documentsLoadingDom, 'English first load and refresh expose the expected DOM states',
        ['documents.list-loading-surface', 'documents.list-hydration'], [
          'the initial request renders the English status, busy panel and four skeleton rows',
          'refresh retains loaded rows, removes skeleton rows and leaves the form enabled',
        ]),
    ],
    retained: [
      {
        cases: [
          at(files.browserDocumentsHydration, 'the search form stays disabled until hydration and opens before the list answers'),
        ],
        reason: 'The DOM cases prove hydrated form and chip state; this E2E case retains disabled server markup and the deferred real client chunk.',
      },
      {
        cases: [
          at(documentsChips, '120-character en search chip ellipsizes and returns native focus at 320px'),
        ],
        reason: 'The DOM case proves the English chip state; this browser case retains ASCII ellipsis, painted icon bounds and native focus return.',
      },
      {
        cases: [
          at(documentsChips, '120-character zh search chip ellipsizes and returns native focus at 320px'),
        ],
        reason: 'The DOM case proves the Chinese chip state; this browser case retains CJK ellipsis, painted icon bounds and native focus return.',
      },
      {
        cases: [
          at(documentsLoading, 'English first-load and refresh indicator geometry survives reduced motion at 1440px'),
        ],
        reason: 'The DOM case proves the first-load and refresh states; this browser case retains native glyph geometry, reduced-motion CSS, desktop overflow and axe results.',
      },
    ],
  },
  {
    id: 'documents.component-loading',
    legacy: [
      at(documentsLoading, 'Chinese first-load and refresh indicator geometry survives reduced motion at 320px'),
    ],
    dom: [
      dom(files.documentsLoadingDom, 'Chinese first load and refresh expose the expected DOM states',
        ['documents.list-loading-surface', 'documents.list-hydration'], [
          'the Chinese initial and refresh states render the expected status and busy state',
          'the first load has four skeleton rows, refresh has none, and the form stays usable with loaded rows',
        ]),
    ],
    retained: [
      {
        cases: [at(documentsLoading, 'Chinese first-load and refresh indicator geometry survives reduced motion at 320px')],
        reason: 'The DOM case proves status, skeleton and form states; the browser case retains computed indicator geometry, reduced-motion CSS, axe and compact overflow.',
      },
    ],
  },
  {
    id: 'documents.component-readiness',
    legacy: [
      at(files.browserDocumentsReadiness, 'list readiness does not wait for an unrelated request that never answers'),
      at(documentsReadiness, 'mounting the list does not wait for the list response'),
    ],
    dom: [
      dom(files.documentsReadinessDom, 'the list mounts while its list request is still unanswered',
        ['documents.list-readiness'], [
          'the heading, busy panel and loading status render while the only list response is held',
          'the returned row renders after the held response is released',
        ]),
    ],
    retained: [
      {
        cases: [
          at(files.browserDocumentsReadiness, 'list readiness does not wait for an unrelated request that never answers'),
        ],
        reason: 'The DOM case proves readiness before the list response; the browser case retains the unrelated admin-shell RSC prefetch hold.',
      },
    ],
  },
  {
    id: 'documents.component-accessibility',
    legacy: [
      at(documentsA11y, 'restoration and refresh notices are accessible in en at 1440px'),
      at(documentsA11y, 'restoration and refresh notices are accessible in zh at 320px'),
    ],
    dom: [
      dom(files.documentsA11yDom, 'English restoration and refresh notices render as an alert and status',
        ['documents.notice-accessibility'], [
          'the English load alert is exposed as an alert and names the refused refresh',
          'the English committed restore is exposed as a status',
        ]),
      dom(files.documentsA11yDom, 'Chinese restoration and refresh notices render as an alert and status',
        ['documents.notice-accessibility'], [
          'the Chinese load alert is exposed as an alert and names the refused refresh',
          'the Chinese committed restore is exposed as a status',
        ]),
    ],
    retained: [
      {
        cases: [
          at(documentsA11y, 'restoration and refresh notices are accessible in en at 1440px'),
          at(documentsA11y, 'restoration and refresh notices are accessible in zh at 320px'),
        ],
        reason: 'The DOM cases prove roles and copy; these browser scans retain axe against computed styles and the live accessibility tree, with the Chinese 320px overflow check.',
      },
    ],
  },
  {
    id: 'catalog.component-manager',
    legacy: [
      at(files.browserCatalogBoundaries, 'catalog retries an unknown creation after refreshing with the original idempotency key'),
      at(files.browserCatalogNavigation, 'an unknown catalog creation retries its original request after browser history navigation'),
      at(catalogManager, 'a slow tag refresh cannot retarget a different entry\'s form'),
      at(catalogManager, 'a slow series refresh cannot retarget a different entry\'s form'),
      at(catalogManager, 'refreshing a clean tag form adopts remote fields without marking it dirty'),
      at(catalogManager, 'refreshing a dirty tag form preserves local edits and adopts untouched remote fields'),
      at(catalogManager, 'a series form creates through the series endpoint'),
      at(catalogManager, 'a confirmed catalog creation stays visible when the list refresh fails'),
      at(catalogManager, 'a slow refresh cannot turn a new catalog entry into an update of the old entry'),
      at(catalogManager, 'catalog retries an unknown creation with the original idempotency key'),
    ],
    dom: [
      dom(files.catalogManagerDom, 'a slow tag refresh cannot retarget a different entry\'s form',
        ['catalog.form-refresh-ui', 'catalog.refresh-rebase'], [
          'a slow tag list read cannot replace the entry currently selected in the form',
          'the update route, fields and expected version belong to the entry the operator selected',
        ]),
      dom(files.catalogManagerDom, 'a slow series refresh cannot retarget a different entry\'s form',
        ['catalog.form-refresh-ui', 'catalog.refresh-rebase'], [
          'a slow series list read cannot replace the entry currently selected in the form',
          'the update route, fields and expected version belong to the entry the operator selected',
        ]),
      dom(files.catalogManagerDom, 'refreshing a clean tag form adopts remote fields without marking it dirty',
        ['catalog.form-refresh-ui', 'catalog.refresh-rebase', 'catalog.clean-save'], [
          'a clean form adopts the remote name, slug and retired flag',
          'the refreshed form remains clean, Save stays disabled and no write is sent',
        ]),
      dom(files.catalogManagerDom, 'refreshing a dirty tag form preserves local edits and adopts untouched remote fields',
        ['catalog.form-refresh-ui', 'catalog.refresh-rebase'], [
          'refresh keeps the locally edited name and adopts the untouched remote slug and retired flag',
          'the update request carries the merged fields and remote expected version',
        ]),
      dom(files.catalogManagerDom, 'a series form creates through the series endpoint',
        ['catalog.save-ack'], [
          'the Series manager renders its own heading and create action',
          'a new series posts the declared fields to the series collection and renders the acknowledgement',
        ]),
      dom(files.catalogManagerDom, 'a confirmed catalog creation stays visible when the list refresh fails',
        ['catalog.save-notices', 'catalog.save-ack'], [
          'the created row and committed status survive a refused following list read',
          'the refresh error is surfaced and typing a new form clears the old creation notice',
        ]),
      dom(files.catalogManagerDom, 'a slow refresh cannot turn a new catalog entry into an update of the old entry',
        ['catalog.save-notices'], [
          'a refresh resolving after New tag is chosen does not convert the draft into an edit',
          'the write remains a collection POST with the new-entry fields, never an update PUT',
        ]),
      dom(files.catalogManagerDom, 'catalog retries an unknown creation with the original idempotency key',
        ['catalog.retry-wiring', 'catalog.save-key'], [
          'a lost creation response is reported as a connection failure and refresh reveals the served entry',
          'retry repeats the same collection POST, body and non-empty idempotency key and renders one row',
        ]),
    ],
    retained: [
      {
        cases: [
          at(files.browserCatalogBoundaries, 'catalog retries an unknown creation after refreshing with the original idempotency key'),
        ],
        reason: 'The DOM case proves the client retry key; this E2E case retains the real catalog Worker and D1 row-count proof.',
      },
      {
        cases: [
          at(files.browserCatalogNavigation, 'an unknown catalog creation retries its original request after browser history navigation'),
        ],
        reason: 'The DOM case proves the keyed retry through refresh; this E2E case retains the native history round trip across route teardown.',
      },
    ],
  },
  {
    id: 'catalog.component-controls',
    legacy: [
      at(catalogControls, 'Search catalog filters by name and slug without touching the edited draft'),
      at(catalogControls, 'New series discard dialog returns native focus after cancel and confirm'),
    ],
    dom: [
      dom(files.catalogControlsDom, 'Search catalog filters by name and slug without touching the edited draft',
        ['catalog.search-ui'], [
          'name and slug search are case-insensitive and clearing the query restores all served rows',
          'search leaves an edited draft unchanged and sends no extra list request',
        ]),
      dom(files.catalogControlsDom, 'New series discards a dirty form only after confirmation and resets it',
        ['catalog.new-series-ui', 'catalog.form-guard'], [
          'the dirty series form offers Cancel and Confirm in its discard dialog',
          'Cancel preserves the draft, Confirm resets the fields and disables Save, and neither branch writes',
        ]),
    ],
    retained: [
      {
        cases: [
          at(catalogControls, 'New series discard dialog returns native focus after cancel and confirm'),
        ],
        reason: 'The DOM case proves dialog and form state; the component browser case retains native focus return to New series and Name.',
      },
    ],
  },
  {
    id: 'catalog.component-accessibility',
    legacy: [
      at(files.browserCatalogA11y, 'Chinese dark catalog navigation preserves the draft and returns focus at 320px'),
      at(catalogA11y, 'Chinese dark catalog discard dialog keeps axe, focus and compact bounds at 320px'),
    ],
    dom: [
      dom(files.catalogA11yDom, 'Chinese dark catalog editing keeps the draft when cancellation closes the dialog',
        ['catalog.form-guard'], [
          'the Chinese dark editor renders the discard dialog with the independently expected title and description',
          'cancellation preserves the local field value and sends no write',
        ]),
    ],
    retained: [
      {
        cases: [
          at(files.browserCatalogA11y, 'Chinese dark catalog navigation preserves the draft and returns focus at 320px'),
        ],
        reason: 'The DOM case proves the edit-switch dialog state; the E2E case retains the real compact navigation menu and route guard.',
      },
      {
        cases: [
          at(catalogA11y, 'Chinese dark catalog discard dialog keeps axe, focus and compact bounds at 320px'),
        ],
        reason: 'The DOM case proves Chinese dialog copy and draft preservation; the browser case retains axe, native focus delivery and measured overflow.',
      },
    ],
  },
]
