/* eslint-disable max-lines, style/max-len, ztd/array-layout -- One row per registered Playwright case. */
/**
 * Where the Documents and Catalog browser assertions move, and what remains
 * native to Playwright. Component rows identify the jsdom successor and retain
 * only a specific engine fact; E2E rows preserve the real route, server and
 * framework lineage that the direct component mount cannot reproduce.
 *
 * This is lineage data, not a test. The DOM case inventory and its migration
 * contracts are checked when the chief integrates the record module.
 */

export type DomRetirement = {
  /** The Playwright case as it is registered today: `file :: title`. */
  readonly playwright: string
  /** jsdom cases that prove part or all of it; empty when no DOM case can. */
  readonly dom: readonly string[]
  /** Original assertions the jsdom cases prove. */
  readonly proves: readonly string[]
  /** Assertions of the same Playwright case that survive only in a browser. */
  readonly remainsBrowser: readonly string[]
}

const documentsList = 'tests/components/specs/documents-list.spec.ts'
const documentsBoundaries = 'tests/components/specs/documents-boundaries.spec.ts'
const documentsChips = 'tests/components/specs/documents-chips.spec.ts'
const documentsLoading = 'tests/components/specs/documents-loading.spec.ts'
const documentsReadiness = 'tests/components/specs/documents-readiness.spec.ts'
const documentsA11y = 'tests/components/specs/documents-a11y.spec.ts'
const catalogManager = 'tests/components/specs/catalog-manager.spec.ts'
const catalogControls = 'tests/components/specs/catalog-controls.spec.ts'
const catalogA11y = 'tests/components/specs/catalog-a11y.spec.ts'

const browserDocumentsBoundaries = 'tests/browser/documents/document-list-boundaries.spec.ts'
const browserDocumentsHydration = 'tests/browser/documents/document-list-hydration.spec.ts'
const browserDocumentsNavigation = 'tests/browser/documents/document-list-navigation.spec.ts'
const browserDocumentsReadiness = 'tests/browser/documents/document-list-readiness.spec.ts'
const browserDocumentsLoading = 'tests/browser/documents/document-loading-polish.spec.ts'
const browserCatalogBoundaries = 'tests/browser/catalog/catalog-boundaries.spec.ts'
const browserCatalogA11y = 'tests/browser/catalog/catalog-boundary-a11y.spec.ts'
const browserCatalogControls = 'tests/browser/catalog/catalog-controls-polish.spec.ts'
const browserCatalogNavigation = 'tests/browser/catalog/catalog-navigation.spec.ts'

function at(file: string, title: string): string {
  return `${file} :: ${title}`
}

function retirement(
  playwright: string,
  dom: readonly string[] = [],
  proves: readonly string[] = [],
  remainsBrowser: readonly string[] = [],
): DomRetirement {
  return { playwright, dom, proves, remainsBrowser }
}

const componentRetirements: readonly DomRetirement[] = [
  retirement(
    at(documentsList, 'a failed first load offers Try again and the retry renders the list'),
    [at('tests/dom/documents-list.test.tsx', 'a failed first load offers Try again and the retry renders the list')],
    [
      'the refused first load renders the load alert and Try again control',
      'retry clears the alert and renders the returned document row',
    ],
  ),
  retirement(
    at(documentsList, 'removing the search chip returns native focus to the search field'),
    [at('tests/dom/documents-list.test.tsx', 'filters narrow the list and their chips remove individually')],
    [
      'search, kind and publication state combine to show the matching document',
      'each active chip names its own filter and removing a chip resets that filter',
      'removing the search chip clears its value while preserving the remaining filters',
    ],
    ['removing the search chip delivers native focus back to the search field'],
  ),
  retirement(
    at(documentsList, 'clearing filters restores the unfiltered list'),
    [at('tests/dom/documents-list.test.tsx', 'clearing filters restores the unfiltered list')],
    [
      'a non-matching search renders the no-matches copy and no document links',
      'Clear filters resets the search and kind controls and restores the served rows',
    ],
  ),
  retirement(
    at(documentsList, 'rows render the draft, published and changed badges'),
    [at('tests/dom/documents-list.test.tsx', 'rows render the draft, published and changed badges')],
    [
      'one row renders per returned entry',
      'draft, published and changed entries render their respective data-state and localized badge copy',
      'the row kind remains separate from the publication badge',
    ],
  ),
  retirement(
    at(documentsList, 'trash rows restore to drafts and leave the trash list'),
    [at('tests/dom/documents-list.test.tsx', 'trash rows restore to drafts and leave the trash list')],
    [
      'trash rows render as text with a restore control described by the row title',
      'restoring sends the listed document id and expected version and removes the trash row',
      'the same document id returns as a draft link after changing the list filter',
    ],
  ),
  retirement(
    at(documentsList, 'Chinese filter bar stays inside the 320px viewport'),
    [at('tests/dom/documents-list.test.tsx', 'Chinese labels render in the compact viewport')],
    [
      'the heading, search, filter controls and create action render with the Chinese copy',
      'choosing the draft state displays the selected Chinese value',
    ],
    ['the live 320px document page has no horizontal overflow'],
  ),
  retirement(
    at(documentsBoundaries, 'pagination failure alert receives native focus'),
    [at('tests/dom/documents-boundaries.test.tsx', 'pagination retries the same cursor and merges without duplicate rows')],
    [
      'a refused page keeps the first 50 rows and renders the next-page alert',
      'retry requests the same cursor and merges the second page without a duplicate row',
      'the completed page removes Load more',
    ],
    [
      'the next-page alert is in the browser viewport and receives native focus',
    ],
  ),
  retirement(
    at(documentsBoundaries, 'failed refresh alert stays in bounds and receives native focus'),
    [at('tests/dom/documents-boundaries.test.tsx', 'a confirmed restore survives a failed refresh and preserves the list state')],
    [
      'a confirmed restore removes the trash row while the following list read is pending',
      'the in-flight refresh holds the sibling restore control and preserves unsubmitted search text',
      'a refused refresh keeps the committed restore status beside the load alert',
      'retry clears the alert without losing the unsubmitted query or Trash filter',
      'the restore request carries the listed document id and expected version',
    ],
    [
      'the restore control and alert stay within the rendered panel at desktop and tablet widths',
      'the failed-refresh alert receives native focus and remains in the viewport',
    ],
  ),
  retirement(
    at(documentsBoundaries, 'restore notices keep their bounds in Chinese at 320px'),
    [at('tests/dom/documents-boundaries.test.tsx', 'Chinese restore notices render in the compact viewport')],
    [
      'the Chinese failed-refresh alert and committed status render together',
    ],
    [
      'the restore control and failed-refresh alert remain inside the 320px viewport',
    ],
  ),
  retirement(
    at(documentsBoundaries, 'restored status receives native focus after retry'),
    [at('tests/dom/documents-boundaries.test.tsx', 'a lost restore response retries with the same idempotency key')],
    [
      'a lost response is reported as an unconfirmed restore',
      'retry repeats the same restore route, expected-version body and non-empty idempotency key',
      'the acknowledged retry removes the row and renders the restored status',
    ],
    [
      'the restored status receives native focus after the retry',
    ],
  ),
  retirement(
    at(documentsBoundaries, 'a restore conflict refreshes the list before another attempt'),
    [at('tests/dom/documents-boundaries.test.tsx', 'a restore conflict refreshes before another attempt')],
    [
      'a conflict names the changed document and offers a refresh',
      'Refresh list answers the conflict without repeating the refused write',
      'a later explicit restore makes one new write and removes the row',
    ],
  ),
  retirement(
    at(documentsChips, '120-character en search chip ellipsizes and returns native focus at 320px'),
    [at('tests/dom/documents-chips.test.tsx', '120-character en search chip is named and removable')],
    [
      'the submitted 120-character search appears in a chip with its independently expected accessible name',
      'removing the chip clears the search draft and removes the active filter',
    ],
    [
      'the English text run ellipsizes inside the 320px viewport, its painted remove icon stays inside the chip and viewport, and native focus returns to the search field',
    ],
  ),
  retirement(
    at(documentsChips, '120-character zh search chip ellipsizes and returns native focus at 320px'),
    [at('tests/dom/documents-chips.test.tsx', '120-character zh search chip is named and removable')],
    [
      'the submitted 120-character Chinese search appears in a chip with its independently expected accessible name',
      'removing the chip clears the search draft and removes the active filter',
    ],
    [
      'the CJK chip text ellipsizes inside the 320px viewport, its SVG remove icon is painted and bounded, and native focus returns to the search field',
    ],
  ),
  retirement(
    at(documentsLoading, 'English first-load and refresh indicator geometry survives reduced motion at 1440px'),
    [at('tests/dom/documents-loading.test.tsx', 'English first load and refresh expose the expected DOM states')],
    [
      'the initial request renders the English status, busy panel and four skeleton rows',
      'refresh retains loaded rows, removes skeleton rows and leaves the form enabled',
    ],
    [
      'the loading glyph has real gap and center alignment, reduced-motion CSS suppresses animation, and both states axe-scan without desktop-page overflow',
    ],
  ),
  retirement(
    at(documentsLoading, 'Chinese first-load and refresh indicator geometry survives reduced motion at 320px'),
    [at('tests/dom/documents-loading.test.tsx', 'Chinese first load and refresh expose the expected DOM states')],
    [
      'the Chinese initial and refresh states render the expected status and busy state',
      'the first load has four skeleton rows, refresh has none, and the form stays usable with loaded rows',
    ],
    [
      'the status glyph has real gap and center alignment, reduced-motion CSS suppresses animation, and both states axe-scan without compact-page overflow',
    ],
  ),
  retirement(
    at(documentsReadiness, 'mounting the list does not wait for the list response'),
    [at('tests/dom/documents-readiness.test.tsx', 'the list mounts while its list request is still unanswered')],
    [
      'the heading, busy panel and loading status render while the only list response is held',
      'the returned row renders after the held response is released',
    ],
  ),
  ...([
    ['en', 1440],
    ['zh', 320],
  ] as const).map(([locale, width]) => {
    const title = `restoration and refresh notices are accessible in ${locale} at ${width}px`
    const domTitle = locale === 'en'
      ? 'English restoration and refresh notices render as an alert and status'
      : 'Chinese restoration and refresh notices render as an alert and status'
    return retirement(
      at(documentsA11y, title),
      [at('tests/dom/documents-a11y.test.tsx', domTitle)],
      [
        `the ${locale === 'en' ? 'English' : 'Chinese'} load alert is exposed as an alert and names the refused refresh`,
        `the ${locale === 'en' ? 'English' : 'Chinese'} committed restore is exposed as a status`,
      ],
      [
        `axe scans the ${locale === 'en' ? 'English light desktop' : 'Chinese dark compact'} notices against real computed styles and the browser accessibility tree`,
        ...(locale === 'zh' ? ['the Chinese notices produce no 320px horizontal overflow'] : []),
      ],
    )
  }),
  ...([
    ['tag', 'a slow tag refresh cannot retarget a different entry\'s form'],
    ['series', 'a slow series refresh cannot retarget a different entry\'s form'],
  ] as const).map(([kind, title]) => retirement(
    at(catalogManager, title),
    [at('tests/dom/catalog-manager.test.tsx', title)],
    [
      `a slow ${kind} list read cannot replace the entry currently selected in the form`,
      'the update route, fields and expected version belong to the entry the operator selected',
    ],
  )),
  retirement(
    at(catalogManager, 'refreshing a clean tag form adopts remote fields without marking it dirty'),
    [at('tests/dom/catalog-manager.test.tsx', 'refreshing a clean tag form adopts remote fields without marking it dirty')],
    [
      'a clean form adopts the remote name, slug and retired flag',
      'the refreshed form remains clean, Save stays disabled and no write is sent',
    ],
  ),
  retirement(
    at(catalogManager, 'refreshing a dirty tag form preserves local edits and adopts untouched remote fields'),
    [at('tests/dom/catalog-manager.test.tsx', 'refreshing a dirty tag form preserves local edits and adopts untouched remote fields')],
    [
      'refresh keeps the locally edited name and adopts the untouched remote slug and retired flag',
      'the update request carries the merged fields and remote expected version',
    ],
  ),
  retirement(
    at(catalogManager, 'a series form creates through the series endpoint'),
    [at('tests/dom/catalog-manager.test.tsx', 'a series form creates through the series endpoint')],
    [
      'the Series manager renders its own heading and create action',
      'a new series posts the declared fields to the series collection and renders the acknowledgement',
    ],
  ),
  retirement(
    at(catalogManager, 'a confirmed catalog creation stays visible when the list refresh fails'),
    [at('tests/dom/catalog-manager.test.tsx', 'a confirmed catalog creation stays visible when the list refresh fails')],
    [
      'the created row and committed status survive a refused following list read',
      'the refresh error is surfaced and typing a new form clears the old creation notice',
    ],
  ),
  retirement(
    at(catalogManager, 'a slow refresh cannot turn a new catalog entry into an update of the old entry'),
    [at('tests/dom/catalog-manager.test.tsx', 'a slow refresh cannot turn a new catalog entry into an update of the old entry')],
    [
      'a refresh resolving after New tag is chosen does not convert the draft into an edit',
      'the write remains a collection POST with the new-entry fields, never an update PUT',
    ],
  ),
  retirement(
    at(catalogManager, 'catalog retries an unknown creation with the original idempotency key'),
    [at('tests/dom/catalog-manager.test.tsx', 'catalog retries an unknown creation with the original idempotency key')],
    [
      'a lost creation response is reported as a connection failure and refresh reveals the served entry',
      'retry repeats the same collection POST, body and non-empty idempotency key and renders one row',
    ],
  ),
  retirement(
    at(catalogControls, 'Search catalog filters by name and slug without touching the edited draft'),
    [at('tests/dom/catalog-controls.test.tsx', 'Search catalog filters by name and slug without touching the edited draft')],
    [
      'name and slug search are case-insensitive and clearing the query restores all served rows',
      'search leaves an edited draft unchanged and sends no extra list request',
    ],
  ),
  retirement(
    at(catalogControls, 'New series discard dialog returns native focus after cancel and confirm'),
    [at('tests/dom/catalog-controls.test.tsx', 'New series discards a dirty form only after confirmation and resets it')],
    [
      'the dirty series form offers Cancel and Confirm in its discard dialog',
      'Cancel preserves the draft, Confirm resets the fields and disables Save, and neither branch writes',
    ],
    [
      'Cancel returns native focus to New series and Confirm returns native focus to the Name field',
    ],
  ),
  retirement(
    at(catalogA11y, 'Chinese dark catalog discard dialog keeps axe, focus and compact bounds at 320px'),
    [at('tests/dom/catalog-a11y.test.tsx', 'Chinese dark catalog editing keeps the draft when cancellation closes the dialog')],
    [
      'the Chinese dark editor renders the discard dialog with the independently expected title and description',
      'cancellation preserves the local field value and sends no write',
    ],
    [
      'axe scans the Chinese dark dialog against the live accessibility tree, focus returns to the row action, and the 320px page has no horizontal overflow',
    ],
  ),
]

const browserRetirements: readonly DomRetirement[] = [
  retirement(
    at(browserDocumentsBoundaries, 'trash retries a lost restoration response without restoring twice'),
    [
      at('tests/dom/documents-boundaries.test.tsx', 'a lost restore response retries with the same idempotency key'),
    ],
    [
      'the UI reports the unknown result, repeats the original keyed request and renders the confirmed restore',
    ],
    [
      'the real Worker and D1 version readback prove the restore committed exactly once',
    ],
  ),
  retirement(
    at(browserDocumentsBoundaries, 'creating after a lost response opens the single confirmed document on retry'),
    [],
    [],
    [
      'the retry uses real create replay, window.location navigation and the hydrated editor at the confirmed document route',
    ],
  ),
  retirement(
    at(browserDocumentsHydration, 'the search form stays disabled until hydration and opens before the list answers'),
    [
      at('tests/dom/documents-chips.test.tsx', '120-character en search chip is named and removable'),
      at('tests/dom/documents-chips.test.tsx', '120-character zh search chip is named and removable'),
      at('tests/dom/documents-loading.test.tsx', 'English first load and refresh expose the expected DOM states'),
    ],
    [
      'the hydrated search, selected filter and removable chip are component state',
      'the form remains enabled while the real list request is pending',
    ],
    [
      'the server-rendered controls stay disabled before the deferred client chunk hydrates',
    ],
  ),
  retirement(
    at(browserDocumentsNavigation, 'a late creation response preserves navigation away from the document list'),
    [],
    [],
    [
      'a held creation acknowledgement must not navigate away from the real Media route after Next has committed it',
    ],
  ),
  retirement(
    at(browserDocumentsReadiness, 'list readiness does not wait for an unrelated request that never answers'),
    [
      at('tests/dom/documents-readiness.test.tsx', 'the list mounts while its list request is still unanswered'),
    ],
    [
      'the mounted list can render while its own request is pending',
    ],
    [
      'the held unrelated request is the real admin-shell RSC prefetch and the page route remains live',
    ],
  ),
  retirement(
    at(browserDocumentsReadiness, 'a prefetch that never answers cannot hold the surface hostage'),
    [],
    [],
    [
      'the deadline is measured against Next-marked browser prefetch requests in a live page',
    ],
  ),
  retirement(
    at(browserDocumentsReadiness, 'the pre-unload deadline also bounds a paint that never completes'),
    [],
    [],
    [
      'the page-level pre-unload deadline is tested while native requestAnimationFrame never paints',
    ],
  ),
  retirement(
    at(browserDocumentsLoading, 'a cancelled-prefetch message stays a failure on the loading surface'),
    [],
    [],
    [
      'the uncaught pageerror comes from the actual cancelled Next prefetch path, which the component host never starts',
    ],
  ),
  retirement(
    at(browserCatalogBoundaries, 'catalog retries an unknown creation after refreshing with the original idempotency key'),
    [
      at('tests/dom/catalog-manager.test.tsx', 'catalog retries an unknown creation with the original idempotency key'),
    ],
    [
      'the manager keeps the unknown creation retryable through a manual list refresh with the same key',
    ],
    [
      'the real catalog Worker and D1 establish one stored row after the replay',
    ],
  ),
  retirement(
    at(browserCatalogA11y, 'Chinese dark catalog navigation preserves the draft and returns focus at 320px'),
    [
      at('tests/dom/catalog-a11y.test.tsx', 'Chinese dark catalog editing keeps the draft when cancellation closes the dialog'),
    ],
    [
      'the independently expected Chinese dialog copy and preserved draft render in the direct CatalogManager mount',
    ],
    [
      'the real compact navigation menu and router guard preserve the route; axe and focus delivery are read from the live page',
    ],
  ),
  retirement(
    at(browserCatalogControls, 'catalog Selects search, support multiple tags and replace series'),
    [],
    [],
    [
      'the editor document-settings Select writes real document metadata, supports multiple tags and replaces the single series',
    ],
  ),
  retirement(
    at(browserCatalogControls, 'catalog failures keep existing selections visible and retry within the searchable Select'),
    [],
    [],
    [
      'the editor Select owns existing document selections while its native searchable popup retries a catalog read',
    ],
  ),
  retirement(
    at(browserCatalogControls, 'search composition commits text without selecting a catalog option or closing its Select'),
    [],
    [],
    [
      'IME composition and keyCode 229 are native composition events in the editor Select',
    ],
  ),
  retirement(
    at(browserCatalogControls, 'catalog Select fits the mobile settings drawer and uses Chinese labels'),
    [],
    [],
    [
      'the Chinese editor popup fits the live mobile settings drawer and returns native focus after selection',
    ],
  ),
  retirement(
    at(browserCatalogControls, 'searchable catalog popups and checked shared Checkbox have no axe violations'),
    [],
    [],
    [
      'axe scans the editor settings Select popups and shared Checkbox against real styles and the browser accessibility tree',
    ],
  ),
  retirement(
    at(browserCatalogNavigation, 'switching a clean catalog form to the other catalog starts an empty form'),
    [],
    [],
    [
      'the real Next route transition switches between separate CatalogManager surfaces',
    ],
  ),
  retirement(
    at(browserCatalogNavigation, 'catalog navigation asks before discarding at 1440px'),
    [],
    [],
    [
      'the desktop navigation link invokes the application route guard and commits the destination only after confirmation',
    ],
  ),
  retirement(
    at(browserCatalogNavigation, 'catalog navigation asks before discarding at 320px'),
    [],
    [],
    [
      'the compact overflow menu, route guard, viewport fit and native focus return to its trigger are browser-owned',
    ],
  ),
  retirement(
    at(browserCatalogNavigation, 'catalog navigation waits for an in-flight save before leaving'),
    [],
    [],
    [
      'the route transition is held across a live PUT and the pending-save confirmation',
    ],
  ),
  retirement(
    at(browserCatalogNavigation, 'catalog draft survives browser back and returning without changing history'),
    [],
    [],
    [
      'native back/forward traversal preserves the rendered draft without growing browser history',
    ],
  ),
  retirement(
    at(browserCatalogNavigation, 'catalog draft survives browser forward and returning without changing history'),
    [],
    [],
    [
      'native forward/back traversal preserves the rendered draft without growing browser history',
    ],
  ),
  retirement(
    at(browserCatalogNavigation, 'an unknown catalog creation retries its original request after browser history navigation'),
    [
      at('tests/dom/catalog-manager.test.tsx', 'catalog retries an unknown creation with the original idempotency key'),
    ],
    [
      'the retry key and body are client state that the direct manager can prove',
    ],
    [
      'the real browser history round trip preserves the failed creation and key across route teardown',
    ],
  ),
  retirement(
    at(browserCatalogNavigation, 'a catalog save stays busy through browser navigation and only updates its original form'),
    [],
    [],
    [
      'a held update is observed across browser back/forward navigation and settles the original form',
    ],
  ),
  retirement(
    at(browserCatalogNavigation, 'tags and series keep independent drafts while traversing the same browser history'),
    [],
    [],
    [
      'independent tag and series session drafts are carried through native browser history traversal',
    ],
  ),
]

export const domRetirements: readonly DomRetirement[] = [
  ...componentRetirements,
  ...browserRetirements,
]

/** Execution boundaries for interpreting the Documents/Catalog migration mapping. */
export const domGatePrerequisites: readonly string[] = [
  'Use the official `test:dom` config; direct mounts prove component state, not Next routing, SSR, browser history or Worker/D1 behavior.',
  'The shared jsdom host declares viewport and media-query facts but proves no measured geometry, computed style, painted SVG, axe tree or native focus delivery.',
  'Exact DOM successors and retired component keys are checked by `documentsCatalogDomMigrations`; this mapping alone is not execution evidence.',
]
