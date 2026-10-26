/* eslint-disable style/max-len -- Verbatim case references stay on one line. */
/* eslint-disable max-lines -- One flat table maps every legacy case to its component cases. */
/**
 * Where every migrated documents/catalog browser assertion now lives.
 *
 * `legacy` names the E2E cases that owned the assertion, `component` names the
 * component browser case that proves it against the real component and a
 * per-case HTTP boundary, and `proves` lists the original assertions that case
 * now covers. `retained` names the cases that stay in the real E2E suite because
 * only the built application can prove them: server-rendered markup, Next
 * routing and native history, window.location navigation, production CSP/auth,
 * real D1 idempotency, and the editor's catalog Select.
 *
 * Files are referenced by the keys below so each entry stays one readable line.
 */
import type { DocumentsCatalogContract } from '~/tests/contracts/documents-catalog'

export type MigrationCase = string
/** A rule id from the contract ledger this file must not duplicate. */
export type ContractReference = DocumentsCatalogContract['id']
export type RetainedCases = {
  readonly cases: readonly MigrationCase[]
  readonly reason: string
}
export type ComponentCase = {
  readonly case: MigrationCase
  readonly describe?: readonly string[]
  /** The contract rules this component case proves, named exactly as in the ledger. */
  readonly contracts: readonly ContractReference[]
  /** Original assertions this component case proves. */
  readonly proves: readonly string[]
}
export type MigrationRecord = {
  readonly id: string
  readonly legacy: readonly MigrationCase[]
  readonly component: readonly ComponentCase[]
  readonly retained: readonly RetainedCases[]
  /** Legacy variants deliberately not rewritten, with what stands in for them. */
  readonly notMigrated?: readonly RetainedCases[]
}

const F = {
  docList: 'tests/browser/documents/documents.spec.ts',
  docBounds: 'tests/browser/documents/document-list-boundaries.spec.ts',
  docNotices: 'tests/browser/documents/document-list-a11y.spec.ts',
  docHydration: 'tests/browser/documents/document-list-hydration.spec.ts',
  docNavigation: 'tests/browser/documents/document-list-navigation.spec.ts',
  docReadiness: 'tests/browser/documents/document-list-readiness.spec.ts',
  docLoading: 'tests/browser/documents/document-loading-polish.spec.ts',
  catBounds: 'tests/browser/catalog/catalog-boundaries.spec.ts',
  catNotices: 'tests/browser/catalog/catalog-boundary-a11y.spec.ts',
  catNavigation: 'tests/browser/catalog/catalog-navigation.spec.ts',
  catSelect: 'tests/browser/catalog/catalog-controls-polish.spec.ts',
  list: 'tests/components/specs/documents-list.spec.ts',
  bounds: 'tests/components/specs/documents-boundaries.spec.ts',
  load: 'tests/components/specs/documents-loading.spec.ts',
  mount: 'tests/components/specs/documents-readiness.spec.ts',
  chips: 'tests/components/specs/documents-chips.spec.ts',
  docA11y: 'tests/components/specs/documents-a11y.spec.ts',
  catalog: 'tests/components/specs/catalog-manager.spec.ts',
  catA11y: 'tests/components/specs/catalog-a11y.spec.ts',
} as const

function c(file: string, title: string): MigrationCase {
  return `${file} :: ${title}`
}

const failedFirstLoad = 'a failed first load offers Try again and the retry renders the list'
const filters = 'removing the search chip returns native focus to the search field'
const clearFilters = 'clearing filters restores the unfiltered list'
const trashRestore = 'trash rows restore to drafts and leave the trash list'
const chineseLabels = 'Chinese filter bar stays inside the 320px viewport'
const badges = 'rows render the draft, published and changed badges'
const pagination = 'pagination failure alert receives native focus'
const restoreFailed = 'failed refresh alert stays in bounds and receives native focus'
const restoreNarrow = 'restore notices keep their bounds in Chinese at 320px'
const restoreLost = 'restored status receives native focus after retry'
const restoreConflict = 'a restore conflict refreshes the list before another attempt'
const noticeEn = 'restoration and refresh notices are accessible in en at 1440px'
const noticeZh = 'restoration and refresh notices are accessible in zh at 320px'
const chipEn = '120-character en search chip ellipsizes and returns native focus at 320px'
const chipZh = '120-character zh search chip ellipsizes and returns native focus at 320px'
const mountHeld = 'mounting the list does not wait for the list response'
const loadingEn = 'English first-load and refresh indicator geometry survives reduced motion at 1440px'
const loadingZh = 'Chinese first-load and refresh indicator geometry survives reduced motion at 320px'
const slowTag = 'a slow tag refresh cannot retarget a different entry\'s form'
const slowSeries = 'a slow series refresh cannot retarget a different entry\'s form'
const cleanRefresh = 'refreshing a clean tag form adopts remote fields without marking it dirty'
const dirtyRefresh = 'refreshing a dirty tag form preserves local edits and adopts untouched remote fields'
const seriesCreate = 'a series form creates through the series endpoint'
const createdRefreshFails = 'a confirmed catalog creation stays visible when the list refresh fails'
const newNotUpdate = 'a slow refresh cannot turn a new catalog entry into an update of the old entry'
const unknownCreation = 'catalog retries an unknown creation with the original idempotency key'
const discardDialog = 'Chinese dark catalog discard dialog keeps axe, focus and compact bounds at 320px'

export const componentMigrations: readonly MigrationRecord[] = [
  {
    id: 'documents.list',
    legacy: [
      c(F.docList, 'documents retry, filter, recover trash and keep bilingual mobile UI'),
    ],
    component: [
      {
        case: c(F.list, failedFirstLoad),
        contracts: [
          'documents.list-load-recovery',
          'documents.list-form-wiring',
          'documents.page-rendering',
        ],
        proves: ['a refused first load announces the load error', 'Try again clears the alert and renders the rows'],
      },
      {
        case: c(F.list, filters),
        contracts: ['documents.list-form-wiring', 'documents.page-rendering'],
        proves: [
          'search plus type and state narrow the list to one row',
          'three chips; removing the type chip shows All types and two rows',
          're-adding the type filter keeps three chips',
          'removing the search chip clears and refocuses the field, leaving two',
        ],
      },
      {
        case: c(F.list, clearFilters),
        contracts: ['documents.list-form-wiring'],
        proves: [
          'a search with no match shows No matching documents',
          'Clear filters resets both selects and the search field',
          'the published row returns after clearing',
        ],
      },
      {
        case: c(F.list, trashRestore),
        contracts: [
          'documents.restore-notices',
          'documents.restore-state',
          'documents.page-rendering',
        ],
        proves: [
          'a deleted document lists in Trash without a row link',
          'its restore control is described by the row title',
          'restore reports the restoration and removes the row',
          'a Draft listing shows the restored document again',
          'the restore write carries the listed row version',
        ],
      },
      {
        case: c(F.list, chineseLabels),
        contracts: ['documents.list-form-wiring'],
        proves: [
          'Chinese heading, search label and selected publication state',
          'at 320px the new-post action and both selects stay visible',
          'no dialog opens and the page does not scroll horizontally',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'documents.pagination',
    legacy: [
      c(F.docBounds, 'pagination reveals its failure and retries the same page without duplicating loaded rows'),
    ],
    component: [
      {
        case: c(F.bounds, pagination),
        contracts: ['documents.list-pagination-ui', 'documents.list-more-retry'],
        proves: [
          '50 rows load; a refused next page shows the next-page alert',
          'the alert is in view, focused and leaves the rows unchanged',
          'Try again retries the same cursor and merges to 51 rows',
          'the merged page never duplicates a loaded row',
          'the cursor sequence is none, page cursor, page cursor',
          'Load more disappears and the end notice shows',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'documents.page-rendering',
    legacy: [],
    component: [
      {
        case: c(F.list, badges),
        contracts: ['documents.page-rendering'],
        proves: [
          'one row per served entry',
          'the draft badge carries data-state=draft and the Draft label',
          'the published badge carries data-state=live and the Published label',
          'the changed badge carries data-state=changed and the Unpublished changes label',
          'a row still names its own kind beside the publication badge',
        ],
      },
      {
        case: c(F.list, filters),
        contracts: ['documents.list-form-wiring', 'documents.page-rendering'],
        proves: ['the active filter chip for each applied field carries its own label'],
      },
      {
        case: c(F.list, failedFirstLoad),
        contracts: [
          'documents.list-load-recovery',
          'documents.list-form-wiring',
          'documents.page-rendering',
        ],
        proves: ['the retry control for a failed load renders with its own label'],
      },
      {
        case: c(F.list, trashRestore),
        contracts: [
          'documents.restore-notices',
          'documents.restore-state',
          'documents.page-rendering',
        ],
        proves: ['a trashed row renders the restore control instead of a link'],
      },
    ],
    retained: [],
  },
  {
    id: 'documents.restore-refresh',
    legacy: [
      c(F.docBounds, 'confirmed restore survives refresh failure in en at 1440px'),
      c(F.docBounds, 'confirmed restore survives refresh failure in en at 800px'),
      c(F.docBounds, 'confirmed restore survives refresh failure in zh at 1440px'),
      c(F.docBounds, 'confirmed restore survives refresh failure in zh at 390px'),
      c(F.docBounds, 'confirmed restore survives refresh failure in zh at 320px'),
    ],
    component: [
      {
        case: c(F.bounds, restoreFailed),
        contracts: ['documents.restore-notices', 'documents.restore-version'],
        proves: [
          'the restore control stays inside the panel without scrolling',
          'desktop and tablet geometry keep the control inside the panel',
          'unsubmitted search text survives the restore and refresh',
          'the restored row leaves and the sibling restore is disabled',
          'a failed refresh shows the load alert in view and focused',
          'the restored status stays visible beside the alert',
          'the restore write carries the row expectedVersion',
          'Try again clears the alert and keeps the search text and Trash',
          'the surface keeps its URL through the whole restore',
        ],
      },
      {
        case: c(F.bounds, restoreNarrow),
        contracts: ['documents.restore-notices', 'documents.restore-version'],
        proves: [
          'the translated load alert and restored status fit at 320px',
          'the restore control and alert stay inside the phone viewport',
        ],
      },
    ],
    retained: [],
    notMigrated: [
      {
        cases: [
          c(F.docBounds, 'confirmed restore survives refresh failure in en at 800px'),
          c(F.docBounds, 'confirmed restore survives refresh failure in zh at 390px'),
        ],
        reason: 'The desktop case resizes the same mounted surface to the tablet grid, and 320px is the narrower phone stress case; both keep the same assertions.',
      },
      {
        cases: [
          c(F.docBounds, 'confirmed restore survives refresh failure in zh at 1440px'),
        ],
        reason: 'Desktop geometry is asserted at 1440px; Chinese notices are asserted at the phone width where translated text is widest.',
      },
    ],
  },
  {
    id: 'documents.restore-lost',
    legacy: [
      c(F.docBounds, 'trash retries a lost restoration response without restoring twice'),
    ],
    component: [
      {
        case: c(F.bounds, restoreLost),
        contracts: ['documents.restore-key', 'documents.restore-notices'],
        proves: [
          'a lost acknowledgement is reported as an unconfirmed restoration',
          'Try again restores once, removes the row and focuses the status',
          'the retry sends the original idempotency key',
        ],
      },
    ],
    retained: [
      {
        cases: [
          c(F.docBounds, 'trash retries a lost restoration response without restoring twice'),
        ],
        reason: 'The stored version advancing exactly once proves database idempotency, which needs real D1 and stays in the E2E case.',
      },
    ],
  },
  {
    id: 'documents.restore-conflict',
    legacy: [
      c(F.docBounds, 'trash conflict refreshes the list before another restore'),
    ],
    component: [
      {
        case: c(F.bounds, restoreConflict),
        contracts: ['documents.restore-conflict', 'documents.restore-conflict-notices'],
        proves: [
          'a conflict reports the changed document and offers a refresh',
          'refreshing clears the alert without repeating the write',
          'a second restore writes again and removes the row',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'documents.create-navigation',
    legacy: [
      c(F.docBounds, 'creating after a lost response opens the single confirmed document on retry'),
    ],
    component: [],
    retained: [
      {
        cases: [
          c(F.docBounds, 'creating after a lost response opens the single confirmed document on retry'),
        ],
        reason: 'The retry ends in window.location.assign to the created document, so only the built application can prove the destination and the opened editor.',
      },
    ],
  },
  {
    id: 'documents.a11y-notices',
    legacy: [
      c(F.docNotices, noticeEn),
      c(F.docNotices, noticeZh),
    ],
    component: [
      {
        case: c(F.docA11y, noticeEn),
        describe: ['accessibility scanner'],
        contracts: ['documents.notice-accessibility'],
        proves: [
          'the restoration alert and status have no axe violations at desktop width',
          'both notices are captured next to the scan',
        ],
      },
      {
        case: c(F.docA11y, noticeZh),
        describe: ['accessibility scanner'],
        contracts: ['documents.notice-accessibility'],
        proves: [
          'the notices have no axe violations in Chinese dark at 320px',
          'the page does not scroll horizontally',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'documents.hydration',
    legacy: [
      c(F.docHydration, 'the search form stays disabled until hydration and opens before the list answers'),
    ],
    component: [
      {
        case: c(F.chips, chipEn),
        contracts: ['documents.list-chip-layout'],
        proves: [
          'a 120-character search chip keeps its accessible name and bounds',
          'removing it refocuses the search field',
        ],
      },
      {
        case: c(F.chips, chipZh),
        contracts: ['documents.list-chip-layout'],
        proves: ['the same chip contract holds for a 120-character Chinese search'],
      },
      {
        case: c(F.load, loadingEn),
        contracts: ['documents.list-loading-surface', 'documents.list-hydration'],
        proves: ['a list request in flight never disables the search form'],
      },
    ],
    retained: [
      {
        cases: [
          c(F.docHydration, 'the search form stays disabled until hydration and opens before the list answers'),
        ],
        reason: 'Server markup disabled until hydration is an SSR property; the component harness mounts already-hydrated client React.',
      },
    ],
  },
  {
    id: 'documents.chips',
    legacy: [
      c(F.docNavigation, 'a late creation response preserves navigation away from the document list'),
      c(F.docNavigation, chipEn),
      c(F.docNavigation, chipZh),
    ],
    component: [
      {
        case: c(F.chips, chipEn),
        contracts: ['documents.list-chip-layout'],
        proves: [
          'the chip keeps its accessible name and stays inside the viewport',
          'its text ellipsises while the remove icon stays visible',
          'removing it clears and refocuses the search field',
        ],
      },
      {
        case: c(F.chips, chipZh),
        contracts: ['documents.list-chip-layout'],
        proves: [
          'the same chip contract holds for a 120-character Chinese search',
          'the translated chip keeps its bounds at 320px',
        ],
      },
    ],
    retained: [
      {
        cases: [
          c(F.docNavigation, 'a late creation response preserves navigation away from the document list'),
        ],
        reason: 'A held creation acknowledgement that resolves after leaving the list needs the real Next route, a second surface and its session request.',
      },
    ],
  },
  {
    id: 'documents.readiness',
    legacy: [
      c(F.docReadiness, 'list readiness does not wait for an unrelated request that never answers'),
      c(F.docReadiness, 'a prefetch that never answers cannot hold the surface hostage'),
      c(F.docReadiness, 'the pre-unload deadline also bounds a paint that never completes'),
    ],
    component: [
      {
        case: c(F.mount, mountHeld),
        contracts: ['documents.list-readiness'],
        proves: [
          'mounting returns while the list request is still unanswered',
          'the heading, panel busy state and loading status are readable',
          'no other API request is issued before the list answers',
        ],
      },
    ],
    retained: [
      {
        cases: [
          c(F.docReadiness, 'list readiness does not wait for an unrelated request that never answers'),
        ],
        reason: 'The unrelated request is the admin shell RSC prefetch, which only the routed application starts.',
      },
      {
        cases: [
          c(F.docReadiness, 'a prefetch that never answers cannot hold the surface hostage'),
          c(F.docReadiness, 'the pre-unload deadline also bounds a paint that never completes'),
        ],
        reason: 'These bound the marked Next prefetches a deliberate unload starts; the component harness serves no router prefetches.',
      },
    ],
  },
  {
    id: 'documents.loading',
    legacy: [
      c(F.docLoading, loadingEn),
      c(F.docLoading, loadingZh),
      c(F.docLoading, 'a cancelled-prefetch message stays a failure on the loading surface'),
    ],
    component: [
      {
        case: c(F.load, loadingEn),
        contracts: ['documents.list-loading-surface', 'documents.list-hydration'],
        proves: [
          'the initial load announces Loading documents and marks the panel busy',
          'four skeleton rows render and the summary is not stuck at zero',
          'a refresh keeps the rows, drops the skeleton and leaves the form enabled',
          'the indicator keeps its gap, centering and no spin under reduced motion',
          'both loading states have no axe violations or horizontal overflow',
          'the run records no page error or console error',
        ],
      },
      {
        case: c(F.load, loadingZh),
        contracts: ['documents.list-loading-surface'],
        proves: [
          'the translated loading and refresh states stay readable at 320px',
          'the same indicator, busy, skeleton and scan contract holds in Chinese',
        ],
      },
    ],
    retained: [
      {
        cases: [
          c(F.docLoading, 'a cancelled-prefetch message stays a failure on the loading surface'),
        ],
        reason: 'The message is the reaction a cancelled route prefetch raises in the real bundle; the harness starts no prefetch.',
      },
    ],
  },
  {
    id: 'catalog.form-rebase',
    legacy: [
      c(F.catBounds, slowTag),
      c(F.catBounds, slowSeries),
      c(F.catBounds, 'refreshing a clean tag form adopts remote fields without marking it dirty'),
      c(F.catBounds, 'refreshing a clean series form adopts remote fields without marking it dirty'),
      c(F.catBounds, 'refreshing a dirty tag form preserves local edits and adopts untouched remote fields'),
      c(F.catBounds, 'refreshing a dirty series form preserves local edits and adopts untouched remote fields'),
    ],
    component: [
      {
        case: c(F.catalog, slowTag),
        contracts: ['catalog.form-refresh-ui', 'catalog.refresh-rebase'],
        proves: [
          'a refresh started before another entry is picked cannot retarget',
          'the written values belong to the entry the form shows',
        ],
      },
      {
        case: c(F.catalog, slowSeries),
        contracts: ['catalog.form-refresh-ui', 'catalog.refresh-rebase'],
        proves: ['the same retarget contract holds for the series catalog'],
      },
      {
        case: c(F.catalog, cleanRefresh),
        contracts: ['catalog.form-refresh-ui', 'catalog.refresh-rebase'],
        proves: [
          'a clean form adopts remote name, slug and retired fields',
          'the adopted form stays clean and Save stays disabled',
        ],
      },
      {
        case: c(F.catalog, dirtyRefresh),
        contracts: ['catalog.form-refresh-ui', 'catalog.refresh-rebase'],
        proves: [
          'a dirty form keeps its local name',
          'untouched remote slug and retired fields are adopted',
          'the write carries the remote version',
        ],
      },
      {
        case: c(F.catalog, seriesCreate),
        contracts: ['catalog.save-ack'],
        proves: [
          'the series surface renders its own heading and New series action',
          'a series creation posts to the series collection',
        ],
      },
    ],
    retained: [],
    notMigrated: [
      {
        cases: [
          c(F.catBounds, 'refreshing a clean series form adopts remote fields without marking it dirty'),
          c(F.catBounds, 'refreshing a dirty series form preserves local edits and adopts untouched remote fields'),
        ],
        reason: 'Both kinds share CatalogSession and the rebase helper, so the series variants repeat the tag assertions; the series surface keeps its own create-path case.',
      },
    ],
  },
  {
    id: 'catalog.creation',
    legacy: [
      c(F.catBounds, 'a confirmed catalog creation stays visible when the list refresh fails'),
      c(F.catBounds, 'a slow refresh cannot turn a new catalog entry into an update of the old entry'),
      c(F.catBounds, 'catalog retries an unknown creation after refreshing with the original idempotency key'),
    ],
    component: [
      {
        case: c(F.catalog, createdRefreshFails),
        contracts: ['catalog.save-notices'],
        proves: [
          'a confirmed creation stays listed after a failed list refresh',
          'the failed refresh is explained without losing the new entry',
          'the next edit clears the creation notice',
        ],
      },
      {
        case: c(F.catalog, newNotUpdate),
        contracts: ['catalog.save-notices'],
        proves: [
          'a refresh landing while a new entry is typed keeps it a creation',
          'the write posts to the collection, never to the old entry',
        ],
      },
      {
        case: c(F.catalog, unknownCreation),
        contracts: ['catalog.retry-wiring', 'catalog.save-key'],
        proves: [
          'an unknown creation is reported as a connection failure',
          'a refresh reveals the committed entry',
          'the retry reuses the original idempotency key and creates one row',
        ],
      },
    ],
    retained: [
      {
        cases: [
          c(F.catBounds, 'catalog retries an unknown creation after refreshing with the original idempotency key'),
        ],
        reason: 'Exactly one stored entry after the retry proves database idempotency, which stays with the real Worker and D1.',
      },
    ],
  },
  {
    id: 'catalog.discard-dialog',
    legacy: [
      c(F.catNotices, 'Chinese dark catalog navigation preserves the draft and returns focus at 320px'),
    ],
    component: [
      {
        case: c(F.catA11y, discardDialog),
        describe: ['accessibility scanner'],
        contracts: ['catalog.navigation-guard'],
        proves: [
          'the unsaved-changes dialog is translated and has no axe violations',
          'it is scanned and captured in Chinese dark at 320px',
          'cancelling returns focus to the control that asked',
          'the draft is preserved and the page does not scroll horizontally',
        ],
      },
    ],
    retained: [
      {
        cases: [
          c(F.catNotices, 'Chinese dark catalog navigation preserves the draft and returns focus at 320px'),
        ],
        reason: 'The legacy case leaves through the routed Tags/Series menu, which needs the real menu, router push and URL change.',
      },
    ],
  },
  {
    id: 'catalog.navigation',
    legacy: [
      c(F.catNavigation, 'switching a clean catalog form to the other catalog starts an empty form'),
      c(F.catNavigation, 'catalog navigation asks before discarding at 1440px'),
      c(F.catNavigation, 'catalog navigation asks before discarding at 320px'),
      c(F.catNavigation, 'catalog navigation waits for an in-flight save before leaving'),
      c(F.catNavigation, 'catalog draft survives browser back and returning without changing history'),
      c(F.catNavigation, 'catalog draft survives browser forward and returning without changing history'),
      c(F.catNavigation, 'an unknown catalog creation retries its original request after browser history navigation'),
      c(F.catNavigation, 'a catalog save stays busy through browser navigation and only updates its original form'),
      c(F.catNavigation, 'tags and series keep independent drafts while traversing the same browser history'),
    ],
    component: [],
    retained: [
      {
        cases: [
          c(F.catNavigation, 'switching a clean catalog form to the other catalog starts an empty form'),
          c(F.catNavigation, 'catalog navigation asks before discarding at 1440px'),
          c(F.catNavigation, 'catalog navigation asks before discarding at 320px'),
          c(F.catNavigation, 'catalog navigation waits for an in-flight save before leaving'),
        ],
        reason: 'These intercept a real Next route push: the guard, the menu trigger, the unchanged URL and the pending-save branch only exist with the router.',
      },
      {
        cases: [
          c(F.catNavigation, 'catalog draft survives browser back and returning without changing history'),
          c(F.catNavigation, 'catalog draft survives browser forward and returning without changing history'),
        ],
        reason: 'History length, a suppressed dialog and a restored form are browser facts; the forward variant mirrors the same guard.',
      },
      {
        cases: [
          c(F.catNavigation, 'a catalog save stays busy through browser navigation and only updates its original form'),
          c(F.catNavigation, 'tags and series keep independent drafts while traversing the same browser history'),
          c(F.catNavigation, 'an unknown catalog creation retries its original request after browser history navigation'),
        ],
        reason: 'A save that stays busy across navigation, per-kind drafts and a key that survives history all need the real router.',
      },
    ],
  },
  {
    id: 'catalog.editor-select',
    legacy: [
      c(F.catSelect, 'catalog Selects search, support multiple tags and replace series'),
      c(F.catSelect, 'catalog failures keep existing selections visible and retry within the searchable Select'),
      c(F.catSelect, 'search composition commits text without selecting a catalog option or closing its Select'),
      c(F.catSelect, 'catalog Select fits the mobile settings drawer and uses Chinese labels'),
      c(F.catSelect, 'searchable catalog popups and checked shared Checkbox have no axe violations'),
    ],
    component: [],
    retained: [
      {
        cases: [
          c(F.catSelect, 'catalog Selects search, support multiple tags and replace series'),
          c(F.catSelect, 'catalog failures keep existing selections visible and retry within the searchable Select'),
          c(F.catSelect, 'search composition commits text without selecting a catalog option or closing its Select'),
          c(F.catSelect, 'catalog Select fits the mobile settings drawer and uses Chinese labels'),
          c(F.catSelect, 'searchable catalog popups and checked shared Checkbox have no axe violations'),
        ],
        reason: 'Every case mounts the editor document settings Select and its draft state, which the CatalogManager surface does not contain.',
      },
    ],
  },
]
