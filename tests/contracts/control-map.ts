/* eslint-disable style/max-len -- Machine-readable accountability table: each
   `note` is data, one row per retired control, so the code-size rules do not apply. */
import type { documentsCatalogContracts } from './documents-catalog'

type ContractId = (typeof documentsCatalogContracts)[number]['id']

export type ControlAccountability = {
  /** Legacy `tests/support/browser/control-inventory.ts` id (surface plus slugged locator). */
  readonly id: string
  readonly surface: 'catalog' | 'documents'
  /** Legacy locator text, kept so a reviewer can match the row without opening the inventory. */
  readonly locator: string
  /** Records that assert this control: browser wiring first, then its server-side rule. */
  readonly contracts: readonly ContractId[]
  /** Whether a browser case actually exercises the affordance and asserts its outcome. */
  readonly asserted: boolean
  /** Suite files that still assert it but sit outside the migrated documents/catalog specs. */
  readonly retainedBy: readonly string[]
  readonly note: string
}

/**
 * Why this exists: `pnpm test:controls` only requires the suites linked to a control to pass, so a
 * control can be listed while no case ever touches its affordance. This map is the replacement
 * accounting for the 22 documents/catalog controls, so the old file-level gate can retire them
 * without the coverage quietly disappearing. `asserted: false` rows are reported gaps, not filled
 * with title-shaped claims.
 * Remaining gaps must be filled before this table can authorize retirement.
 */
export const documentsCatalogControlMap = [
  {
    id: 'documents.new-post',
    surface: 'documents',
    locator: 'New post',
    contracts: ['documents.create-retry-navigation', 'documents.create-replay'],
    asserted: true,
    retainedBy: ['tests/browser/journeys/lifecycle.spec.ts'],
    note: 'Asserted: the retry case clicks New post and ends on the confirmed document; the journey clicks it for the happy path and reads the editor URL.',
  },
  {
    id: 'documents.new-page',
    surface: 'documents',
    locator: 'New page',
    contracts: ['documents.create-page-navigation'],
    asserted: true,
    retainedBy: ['tests/browser/journeys/lifecycle.spec.ts'],
    note: 'The real page destination is intentionally E2E-owned: the lifecycle journey clicks New page, publishes it and reads /pages/journey-page. API seeds and host adapters do not establish that contract.',
  },
  {
    id: 'documents.search-by-title',
    surface: 'documents',
    locator: 'Search by title',
    contracts: [
      'documents.list-form-wiring',
      'documents.list-search-draft',
      'documents.list-query',
    ],
    asserted: true,
    retainedBy: [],
    note: 'Asserted: the page case fills the box, submits a no-match query and reads the empty state; the unit records own query parsing and the draft-versus-applied split.',
  },
  {
    id: 'documents.search',
    surface: 'documents',
    locator: 'Search',
    contracts: ['documents.list-form-wiring', 'documents.list-hydration'],
    asserted: true,
    retainedBy: [],
    note: 'Asserted: submit applies the query and builds the chip; the hydration case proves the button is disabled before React owns the markup and enabled afterwards.',
  },
  {
    id: 'documents.document-type',
    surface: 'documents',
    locator: 'Document type',
    contracts: ['documents.list-form-wiring', 'documents.list-filter'],
    asserted: true,
    retainedBy: [],
    note: 'Asserted: selecting Page narrows the list to one row and adds its chip; the filter rule is SQL at the Worker.',
  },
  {
    id: 'documents.publication-state',
    surface: 'documents',
    locator: 'Publication state',
    contracts: [
      'documents.list-form-wiring',
      'documents.list-filter',
      'documents.delete-guard',
    ],
    asserted: true,
    retainedBy: ['tests/browser/journeys/lifecycle.spec.ts'],
    note: 'Asserted: Draft and Trash selections are read through the list, including the trashed row controls; the journey also switches to Trash after a real delete.',
  },
  {
    id: 'documents.clear-filters',
    surface: 'documents',
    locator: 'Clear filters',
    contracts: ['documents.list-form-wiring'],
    asserted: true,
    retainedBy: ['tests/browser/journeys/lifecycle.spec.ts'],
    note: 'Asserted: both cases click Clear filters and read the reset combobox, the emptied search box and the restored rows.',
  },
  {
    id: 'documents.remove-filter',
    surface: 'documents',
    locator: 'Remove filter',
    contracts: ['documents.list-chip-layout', 'documents.list-form-wiring'],
    asserted: true,
    retainedBy: [],
    note: 'Asserted: chip removal resets its own field and returns focus to the search box, and the 120-character chip case reads its ellipsis and icon before removal.',
  },
  {
    id: 'documents.refresh-list',
    surface: 'documents',
    locator: 'Refresh list',
    contracts: [
      'documents.list-form-wiring',
      'documents.list-loading-surface',
      'documents.list-readiness',
    ],
    asserted: true,
    retainedBy: [],
    note: 'Asserted: refresh is clicked and awaited in the page, loading and readiness cases; the stale-response rule it depends on is unit-proven.',
  },
  {
    id: 'documents.load-more',
    surface: 'documents',
    locator: 'Load more',
    contracts: [
      'documents.list-pagination-ui',
      'documents.list-more-retry',
      'documents.list-page',
    ],
    asserted: true,
    retainedBy: [],
    note: 'Asserted: the case clicks Load more, reads the focused failure alert, retries the same cursor, counts the appended row and asserts the control disappears at the end.',
  },
  {
    id: 'documents.document-link',
    surface: 'documents',
    locator: 'Document link',
    contracts: ['documents.open-document-navigation'],
    asserted: true,
    retainedBy: ['tests/browser/journeys/lifecycle.spec.ts'],
    note: 'The component proves row visibility only. The separate E2E navigation contract retains the lifecycle journey click, real editor URL and reopened content; it is not replaced by the host-anchor adapter.',
  },
  {
    id: 'documents.restore-draft',
    surface: 'documents',
    locator: 'Restore draft',
    contracts: [
      'documents.restore-notices',
      'documents.restore-conflict-notices',
      'documents.restore-key',
      'documents.restore-version',
    ],
    asserted: true,
    retainedBy: ['tests/browser/journeys/lifecycle.spec.ts'],
    note: 'Asserted: the button is clicked in the refresh-failure, lost-response and conflict cases with its accessible description, focus and bounds read; the journey restores a really deleted article.',
  },
  {
    id: 'documents.try-again',
    surface: 'documents',
    locator: 'Try again',
    contracts: [
      'documents.list-form-wiring',
      'documents.list-pagination-ui',
      'documents.restore-notices',
      'documents.list-load-recovery',
    ],
    asserted: true,
    retainedBy: [],
    note: 'Asserted: the initial-load banner, the pagination alert and the unconfirmed restoration each offer a Try again that is clicked and followed by the recovered state.',
  },
  {
    id: 'catalog.new-tag-new-series',
    surface: 'catalog',
    locator: 'New tag / New series',
    contracts: [
      'catalog.form-guard',
      'catalog.save-notices',
      'catalog.new-series-ui',
    ],
    asserted: true,
    retainedBy: [],
    note: 'New tag retains the form guard and creation proof. The added component contract explicitly clicks New series and proves both discard decisions, field reset and focus rather than merely navigating to Series.',
  },
  {
    id: 'catalog.name',
    surface: 'catalog',
    locator: 'Name',
    contracts: [
      'catalog.form-refresh-ui',
      'catalog.form-guard',
      'catalog.refresh-rebase',
    ],
    asserted: true,
    retainedBy: [],
    note: 'Asserted: typing is preserved through refresh and navigation, saved with the row, and cleared by a confirmed discard.',
  },
  {
    id: 'catalog.slug',
    surface: 'catalog',
    locator: 'Slug',
    contracts: [
      'catalog.form-guard',
      'catalog.form-refresh-ui',
      'catalog.access',
    ],
    asserted: true,
    retainedBy: [],
    note: 'Asserted: the field reports its own pattern mismatch with the rule as its description, and the server refuses an invalid or unknown body with 400. The draft is kept because the client never submits an invalid value.',
  },
  {
    id: 'catalog.retired',
    surface: 'catalog',
    locator: 'Retired',
    contracts: [
      'catalog.form-guard',
      'catalog.form-refresh-ui',
      'catalog.retirement',
    ],
    asserted: true,
    retainedBy: [],
    note: 'Asserted: checking Retired saves the row, the row list marks it retired, and the published snapshot of documents that referenced it is untouched.',
  },
  {
    id: 'catalog.search-catalog',
    surface: 'catalog',
    locator: 'Search catalog',
    contracts: ['catalog.search-ui'],
    asserted: true,
    retainedBy: [],
    note: 'The former coverage gap is now explicit: a real component case types name/slug queries, clears the search and preserves an edited draft without navigation or extra HTTP calls.',
  },
  {
    id: 'catalog.refresh',
    surface: 'catalog',
    locator: 'Refresh',
    contracts: ['catalog.form-refresh-ui', 'catalog.form-guard'],
    asserted: true,
    retainedBy: [],
    note: 'Asserted: refresh adopts untouched remote fields, keeps local edits, never retargets another entry, and retains the local name after a conflict.',
  },
  {
    id: 'catalog.edit-entry',
    surface: 'catalog',
    locator: 'Edit entry',
    contracts: [
      'catalog.form-refresh-ui',
      'catalog.save-busy',
      'catalog.form-guard',
    ],
    asserted: true,
    retainedBy: [],
    note: 'Asserted: the correct row is selected, a held refresh cannot retarget it, the row is re-read after a save, and editing a clean row keeps Save disabled.',
  },
  {
    id: 'catalog.save',
    surface: 'catalog',
    locator: 'Save',
    contracts: [
      'catalog.save-notices',
      'catalog.save-busy',
      'catalog.retry-wiring',
      'catalog.clean-save',
      'catalog.save-ack',
      'catalog.update-version',
      'catalog.create-replay',
    ],
    asserted: true,
    retainedBy: [],
    note: 'Asserted: Save is disabled on a clean form and enabled once a field changes, keeps busy through navigation, retries an unknown creation with its original key, and sends the expectedVersion the server guards.',
  },
  {
    id: 'catalog.cancel-confirm-discard',
    surface: 'catalog',
    locator: 'Cancel / Confirm discard',
    contracts: ['catalog.navigation-guard', 'catalog.form-guard'],
    asserted: true,
    retainedBy: [],
    note: 'Asserted for both dialog variants: the navigation dialog (leave/ cancel/ Escape with focus back on the trigger) and the form dialog (discard a dirty form and clear it, keeping the draft on Cancel).',
  },
] as const satisfies readonly ControlAccountability[]
