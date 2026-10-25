/* eslint-disable max-lines, style/max-len -- Machine-readable contract table: `behavior` and
   `rationale` are data, one record per boundary rule, so the code-size rules do not apply. */
/**
 * Test-layer contract map for the documents/catalog slice.
 *
 * Each record names one boundary rule and the layer that currently proves it (`primary`). A ref is
 * evidence, not a suggestion: a record lists a case only when that case's assertions actually read
 * the behavior. Rules a unit test can decide carry no browser refs; DOM wiring has its own record
 * whose primary is `e2e` (or `component` once the component layer carries it).
 *
 * `component` is empty in this revision because the documents/catalog component migration has not
 * landed: `documents.page-rendering` is the one record that claims that layer, and its refs arrive
 * with the migration. Until then its rule is proven at unit level and its rendering is unproven.
 *
 * Browser refs name their Playwright projects, because a case that only runs in one engine cannot be
 * cited for both, and a `describe` path when the case is nested. Every declared e2e ref is an
 * existing case of the current suite; this map does not execute them (see the slice report for the
 * native checks that were run).
 *
 * `documentsCatalogLegacyCases` keeps the layer decision for every documents/catalog browser case
 * that exists today, so the migration deletes a case knowing which record still relies on it.
 */

/** Closed vocabulary for `dimensions`; a record may only use these tokens. */
export const documentsCatalogDimensions = [
  'access',
  'accessibility',
  'client-state',
  'concurrency',
  'cursor',
  'db-integrity',
  'error-mapping',
  'filter',
  'focus',
  'hydration',
  'i18n',
  'idempotency',
  'layout',
  'maintenance',
  'navigation',
  'ordering',
  'pagination',
  'query',
  'readiness',
  'scheduling',
  'selection',
  'session-isolation',
  'validation',
  'version',
] as const

type Dimension = (typeof documentsCatalogDimensions)[number]
type Layer = 'component' | 'e2e' | 'integration' | 'unit'

/** A Node case: `title` is the exact reported test title (a subtest title for nested `t.test`). */
type NodeEvidence = {
  readonly file: string
  readonly title: string
}
/** A browser case: `title` is the exact reported title, `projects` every engine it runs in. */
type BrowserEvidence = {
  readonly describe?: readonly string[]
  readonly file: string
  readonly projects: readonly ('chromium' | 'webkit')[]
  readonly title: string
}

export type DocumentsCatalogContract = {
  readonly id: `catalog.${string}` | `documents.${string}`
  /** The layer that must prove this rule; it always has at least one ref. */
  readonly primary: Layer
  readonly behavior: string
  readonly unit: readonly NodeEvidence[]
  readonly integration: readonly NodeEvidence[]
  readonly component: readonly BrowserEvidence[]
  readonly e2e: readonly BrowserEvidence[]
  readonly dimensions: readonly Dimension[]
  readonly rationale: string
}

const both = ['chromium', 'webkit'] as const

export const documentsCatalogContracts = [
  // ---------------------------------------------------------------- documents: reading the list
  {
    id: 'documents.list-query',
    primary: 'unit',
    behavior: 'The list query is parsed once: duplicated or unknown fields, values outside the filter enums, a search over 120 characters and a cursor bound to other filters are 400 INVALID_QUERY, while a filtered cursor round-trips the filters that produced it.',
    unit: [
      {
        file: 'tests/unit/document-list.test.ts',
        title: 'document queries reject unknown/duplicate fields and filter-incompatible cursors',
      },
    ],
    integration: [
      {
        file: 'tests/integration/document-list.integration.ts',
        title: 'admin documents search, filtered pagination and tombstone recovery use the Worker',
      },
    ],
    component: [],
    e2e: [],
    dimensions: [
      'query',
      'cursor',
      'validation',
      'error-mapping',
    ],
    rationale: 'The rejection matrix is a pure parser decision, so unit carries it and the Worker case proves only the HTTP mapping (400 plus problem body, and the v1 token the same server emits). A browser case would restate the matrix, because the form can only send what documentListPath builds.',
  },
  {
    id: 'documents.list-page',
    primary: 'integration',
    behavior: 'A page holds at most 50 rows ordered by updated_at then id, so cursor paging covers every matching row exactly once even when timestamps tie; filtered pages return v1. cursors and unfiltered pages keep the plain time:id form.',
    unit: [],
    integration: [
      {
        file: 'tests/integration/document-list.integration.ts',
        title: 'admin documents search, filtered pagination and tombstone recovery use the Worker',
      },
    ],
    component: [],
    e2e: [],
    dimensions: [
      'pagination',
      'ordering',
      'cursor',
    ],
    rationale: 'Page size, the tie-break and both cursor encodings are SQL and route code in the built Worker; a unit test would have to restate the query. The seeded rows share one updated_at, so the id tie-break is what the case actually reads.',
  },
  {
    id: 'documents.list-filter',
    primary: 'integration',
    behavior: 'Title search matches literal text case-insensitively (percent and quote are data, not patterns), kind filters article/page, and publication state maps draft/published/changed to the live-versus-head revision relation, with deleted rows reachable only through state=deleted.',
    unit: [],
    integration: [
      {
        file: 'tests/integration/document-list.integration.ts',
        title: 'admin documents search, filtered pagination and tombstone recovery use the Worker',
      },
    ],
    component: [],
    e2e: [],
    dimensions: ['filter', 'db-integrity'],
    rationale: 'The state predicates are SQL over live/head revisions and deleted_at, and the case edits a published document to reach state=changed; only the built Worker can answer that. The control that sends the filter is component wiring, not this rule.',
  },
  {
    id: 'documents.list-row-state',
    primary: 'unit',
    behavior: 'A row publication state follows its live revision relative to head: no live revision is draft, equal is published, different is changed.',
    unit: [
      {
        file: 'tests/unit/document-list.test.ts',
        title: 'a row publication state follows its live revision relative to head',
      },
    ],
    integration: [],
    component: [],
    e2e: [],
    dimensions: ['client-state'],
    rationale: 'Pure mapping between the three revision fields and the badge state. The server counterpart is documents.list-filter; rendering the three badges is documents.page-rendering.',
  },
  {
    id: 'documents.list-stale-result',
    primary: 'unit',
    behavior: 'A late list or pagination response never replaces a newer filter result: entries, cursor and filters stay those of the newest request, and a late pagination failure cannot raise an error over it.',
    unit: [
      {
        file: 'tests/unit/document-list.test.ts',
        title: 'a late response never replaces the newer filter results',
      },
      {
        file: 'tests/unit/document-list-boundaries.test.ts',
        title: 'a late pagination success cannot replace new filters',
      },
      {
        file: 'tests/unit/document-list-boundaries.test.ts',
        title: 'a late pagination failure cannot replace new filters',
      },
    ],
    integration: [],
    component: [],
    e2e: [],
    dimensions: [
      'concurrency',
      'client-state',
      'error-mapping',
    ],
    rationale: 'A request-order race inside one controller; the browser can only observe its outcome by timing two real requests, which is less deterministic and asserts the same state.',
  },
  {
    id: 'documents.list-search-draft',
    primary: 'unit',
    behavior: 'Refresh keeps the unsubmitted search text while the applied filters stay the submitted ones; submitting text applies it, and an explicit filter set replaces the draft.',
    unit: [
      {
        file: 'tests/unit/document-list.test.ts',
        title: 'search drafts share controller state and list responses preserve further typing',
      },
      {
        file: 'tests/unit/document-list-boundaries.test.ts',
        title: 'refresh preserves unsubmitted search text while explicit filter changes update it',
      },
    ],
    integration: [],
    component: [],
    e2e: [],
    dimensions: ['client-state'],
    rationale: 'The draft-versus-applied split is controller state, including which query string the next request carries. Typing into the box is component wiring.',
  },
  {
    id: 'documents.list-more-retry',
    primary: 'unit',
    behavior: 'A failed next page keeps the loaded rows and the same cursor, retries that exact cursor, merges without duplicating rows, and a later explicit filter clears both.',
    unit: [
      {
        file: 'tests/unit/document-list.test.ts',
        title: 'pagination failure keeps entries and retries the same cursor without duplicates',
      },
    ],
    integration: [],
    component: [],
    e2e: [],
    dimensions: [
      'pagination',
      'client-state',
      'error-mapping',
    ],
    rationale: 'Cursor retention and merge order are controller decisions. The failure banner and the Load more control are documents.list-pagination-ui.',
  },
  {
    id: 'documents.list-load-recovery',
    primary: 'unit',
    behavior: 'A failed first load stays retryable, surfaces the server problem code, and a cancelled request never writes its answer into state.',
    unit: [
      {
        file: 'tests/unit/document-list.test.ts',
        title: 'failed initial load can recover and cancellation ignores a pending response',
      },
    ],
    integration: [],
    component: [],
    e2e: [],
    dimensions: ['client-state', 'error-mapping'],
    rationale: 'Retryability and cancellation are controller state. The retry banner the operator sees is covered by documents.page-rendering once the component layer exists.',
  },
  {
    id: 'documents.access',
    primary: 'integration',
    behavior: 'The list and its mutations require the owner JWT; a mutation additionally requires the page origin and the CSRF token.',
    unit: [],
    integration: [
      {
        file: 'tests/integration/worker.integration.ts',
        title: 'built Worker: private boundaries, head/live isolation, CAS, replay, immutable history and FTS',
      },
      {
        file: 'tests/integration/document-list.integration.ts',
        title: 'document writes stay version-guarded while list reads survive maintenance',
      },
    ],
    component: [],
    e2e: [],
    dimensions: ['access', 'validation'],
    rationale: 'The first case carries the access matrix as its "missing JWT/invalid host/encoded paths/Origin and CSRF fail closed" subtest, which refuses the documents mutation without owner token, origin or CSRF token; the second proves the list read itself is 401 without the owner token, which the page-level checks did not read.',
  },
  {
    id: 'documents.maintenance',
    primary: 'integration',
    behavior: 'Maintenance refuses list writes (create and restoration) with 503 MAINTENANCE while list reads, including the trash listing, stay available.',
    unit: [],
    integration: [
      {
        file: 'tests/integration/document-list.integration.ts',
        title: 'document writes stay version-guarded while list reads survive maintenance',
      },
    ],
    component: [],
    e2e: [],
    dimensions: ['maintenance', 'error-mapping'],
    rationale: 'Maintenance is a guard inside the write transaction, so only the Worker can show that reads survive it. The client handling a 503 code is documents.mutation-outcome and documents.list-load-recovery.',
  },
  {
    id: 'documents.create-replay',
    primary: 'integration',
    behavior: 'A creation retried under the same idempotency key answers the first document and leaves one row; the same key with another body is 409 IDEMPOTENCY_KEY_REUSED.',
    unit: [],
    integration: [
      {
        file: 'tests/integration/document-list.integration.ts',
        title: 'document writes stay version-guarded while list reads survive maintenance',
      },
    ],
    component: [],
    e2e: [],
    dimensions: ['idempotency', 'db-integrity'],
    rationale: 'Replay is a journal lookup plus a row count, so the Worker case asserts what the browser case cannot see. The key the client holds is documents.restore-key and the navigation after the retry is documents.create-retry-navigation.',
  },
  {
    id: 'documents.delete-guard',
    primary: 'integration',
    behavior: 'Only an unpublished document enters trash: deleting a live document with its current version is 409 EDIT_CONFLICT and the row stays, while a draft delete soft-deletes it, 404s its open route and exposes it under state=deleted with its version.',
    unit: [],
    integration: [
      {
        file: 'tests/integration/document-list.integration.ts',
        title: 'document writes stay version-guarded while list reads survive maintenance',
      },
      {
        file: 'tests/integration/document-list.integration.ts',
        title: 'admin documents search, filtered pagination and tombstone recovery use the Worker',
      },
    ],
    component: [],
    e2e: [],
    dimensions: [
      'version',
      'db-integrity',
      'filter',
    ],
    rationale: 'The refusal is a guard condition on live_revision_id plus the live generation, and the accepted delete is observable only as tombstone columns and list states.',
  },
  {
    id: 'documents.restore-version',
    primary: 'integration',
    behavior: 'Restoration is guarded by expectedVersion: a stale version is 409 without writing, maintenance is 503, and a success increments version once, returns the row to draft, keeps the live generation, cancels its pending schedule and adds no revision.',
    unit: [],
    integration: [
      {
        file: 'tests/integration/document-list.integration.ts',
        title: 'admin documents search, filtered pagination and tombstone recovery use the Worker',
      },
    ],
    component: [],
    e2e: [],
    dimensions: [
      'version',
      'maintenance',
      'scheduling',
      'db-integrity',
    ],
    rationale: 'The case reads the row, the revision count, the schedule state and the empty guard table, which is the only place this rule is fully proven; the browser can only see the acknowledgement.',
  },
  {
    id: 'documents.restore-key',
    primary: 'unit',
    behavior: 'An unconfirmed restoration is retried with the same idempotency key and an identical body, and the list is refreshed only after the acknowledgement arrives.',
    unit: [
      {
        file: 'tests/unit/document-list.test.ts',
        title: 'trash restore retries the same mutation after an unknown result and then refreshes',
      },
    ],
    integration: [
      {
        file: 'tests/integration/document-list.integration.ts',
        title: 'admin documents search, filtered pagination and tombstone recovery use the Worker',
      },
    ],
    component: [],
    e2e: [],
    dimensions: ['idempotency', 'client-state'],
    rationale: 'The unit case proves the client keeps key and body; the Worker case proves the server answers the replay instead of restoring twice. Together they close the loop without a browser.',
  },
  {
    id: 'documents.restore-state',
    primary: 'unit',
    behavior: 'A confirmed restoration removes its trash row immediately, keeps the unsubmitted search text and holds every other write until the following refresh settles; a failed refresh keeps the removal and reports the load error.',
    unit: [
      {
        file: 'tests/unit/document-list-boundaries.test.ts',
        title: 'confirmed restoration removes its trash row and holds other writes until refresh settles',
      },
    ],
    integration: [],
    component: [],
    e2e: [],
    dimensions: [
      'client-state',
      'error-mapping',
      'concurrency',
    ],
    rationale: 'Row removal, the mutation lock and the retained draft are controller state; the case also asserts that no second write leaves the page while the refresh is in flight.',
  },
  {
    id: 'documents.restore-conflict',
    primary: 'unit',
    behavior: 'A restoration refused as EDIT_CONFLICT refreshes the list instead of repeating the write, so the operator sees the current row before a second attempt.',
    unit: [
      {
        file: 'tests/unit/document-list-boundaries.test.ts',
        title: 'a version conflict refreshes the list instead of repeating the restoration',
      },
    ],
    integration: [],
    component: [],
    e2e: [],
    dimensions: [
      'error-mapping',
      'version',
      'client-state',
    ],
    rationale: 'The rule is a branch of retry(): no second POST, and a reload with the current filters. The alert copy and its Refresh list affordance are documents.restore-conflict-notices.',
  },
  {
    id: 'documents.mutation-outcome',
    primary: 'unit',
    behavior: 'A transport failure or 5xx during create or restore is MUTATION_OUTCOME_UNKNOWN, a definite 503 MAINTENANCE stays MAINTENANCE, and a retry repeats the same keyed request.',
    unit: [
      {
        file: 'tests/unit/document-list-boundaries.test.ts',
        title: 'restoration distinguishes unknown network outcomes from definite maintenance refusals',
      },
    ],
    integration: [],
    component: [],
    e2e: [],
    dimensions: ['error-mapping', 'maintenance'],
    rationale: 'The distinction decides whether a retry is offered at all, and it is made from the error shape before any DOM exists.',
  },

  // -------------------------------------------------------- documents: browser-only wiring
  {
    id: 'documents.list-form-wiring',
    primary: 'e2e',
    behavior: 'The list page sends the filters the operator chose (search, kind, state), removes an active filter chip by clearing that field, refreshes from the toolbar, and restores a trashed row from the row itself.',
    unit: [],
    integration: [],
    component: [],
    e2e: [
      {
        file: 'tests/browser/documents/documents.spec.ts',
        projects: both,
        title: 'documents retry, filter, recover trash and keep bilingual mobile UI',
      },
    ],
    dimensions: [
      'filter',
      'focus',
      'i18n',
      'layout',
    ],
    rationale: 'This is the current representative of the page-level wiring: combobox filtering, chip removal with focus return, the retry banner and the trashed row. It is also the only case that renders 390px Chinese layout with no body overflow. Its filter steps are component material, so the legacy map records it as a split rather than a case to extend.',
  },
  {
    id: 'documents.list-chip-layout',
    primary: 'e2e',
    behavior: 'A 120-character search chip stays inside its row, ellipsizes its text, keeps its icon, and its removal returns focus to the search box with the value cleared.',
    unit: [],
    integration: [],
    component: [],
    e2e: [
      {
        file: 'tests/browser/documents/document-list-navigation.spec.ts',
        projects: both,
        title: '120-character zh search chips fit at 320px and can be removed',
      },
    ],
    dimensions: [
      'layout',
      'focus',
      'i18n',
    ],
    rationale: 'The assertion reads measured overflow and text-overflow of a real rendered chip. The CJK variant is kept because the same assertions with Latin text fit with more room; the Latin variant is dropped in the legacy map as a duplicate.',
  },
  {
    id: 'documents.list-pagination-ui',
    primary: 'e2e',
    behavior: 'A failed next page shows an in-viewport, focused alert above the loaded rows; retrying requests the same cursor, appends only the new row and hides Load more at the end of the list.',
    unit: [],
    integration: [],
    component: [],
    e2e: [
      {
        file: 'tests/browser/documents/document-list-boundaries.spec.ts',
        projects: both,
        title: 'pagination reveals its failure and retries the same page without duplicating loaded rows',
      },
    ],
    dimensions: [
      'pagination',
      'focus',
      'client-state',
    ],
    rationale: 'Alert focus, viewport position and the request order observed as the operator clicks are browser facts; the cursor and merge rules are already unit-proven (documents.list-more-retry).',
  },
  {
    id: 'documents.list-hydration',
    primary: 'e2e',
    behavior: 'The list form renders disabled until React owns the server markup, then enables search, submit and both filters before the first list request answers; a list request in flight marks the panel aria-busy without disabling the form.',
    unit: [],
    integration: [],
    component: [],
    e2e: [
      {
        file: 'tests/browser/documents/document-list-hydration.spec.ts',
        projects: both,
        title: 'the search form stays disabled until hydration and opens before the list answers',
      },
    ],
    dimensions: [
      'hydration',
      'focus',
      'layout',
    ],
    rationale: 'Only a real server render followed by a deferred chunk shows the disabled-to-enabled window; no unit or component case can produce it without re-implementing hydration.',
  },
  {
    id: 'documents.list-readiness',
    primary: 'e2e',
    behavior: 'Readiness is the rendered list state, not network silence: an unrelated prefetch that never answers, a prefetch held past the deadline, or a paint that never completes cannot hold the surface or the pre-unload wait.',
    unit: [],
    integration: [],
    component: [],
    e2e: [
      {
        file: 'tests/browser/documents/document-list-readiness.spec.ts',
        projects: both,
        title: 'list readiness does not wait for an unrelated request that never answers',
      },
      {
        file: 'tests/browser/documents/document-list-readiness.spec.ts',
        projects: both,
        title: 'a prefetch that never answers cannot hold the surface hostage',
      },
      {
        file: 'tests/browser/documents/document-list-readiness.spec.ts',
        projects: both,
        title: 'the pre-unload deadline also bounds a paint that never completes',
      },
    ],
    dimensions: ['readiness', 'concurrency'],
    rationale: 'These cases hold real prefetch and animation traffic open and assert deadline returns; the behavior only exists in a live page with the framework prefetcher.',
  },
  {
    id: 'documents.list-loading-surface',
    primary: 'e2e',
    behavior: 'While the list loads or refreshes the panel is aria-busy, skeleton rows appear only on a first load, the status text is the localized string with an aligned indicator, and no uncaught page error is excused, including a cancelled-prefetch message.',
    unit: [],
    integration: [],
    component: [],
    e2e: [
      {
        file: 'tests/browser/documents/document-loading-polish.spec.ts',
        projects: both,
        title: 'document loading and refresh stay readable in zh at 320px',
      },
      {
        file: 'tests/browser/documents/document-loading-polish.spec.ts',
        projects: both,
        title: 'a cancelled-prefetch message stays a failure on the loading surface',
      },
    ],
    dimensions: [
      'layout',
      'accessibility',
      'i18n',
      'error-mapping',
    ],
    rationale: 'The case measures indicator geometry, scans accessibility and collects pageerror events, none of which a controller can observe. The zh 320 variant is kept because it also scans accessibility and the narrow layout; the en 1440 variant repeats the same assertions.',
  },
  {
    id: 'documents.page-rendering',
    primary: 'component',
    behavior: 'The list panel renders a row per entry with its draft/published/changed badge, the active filter chips with their labels, and the retry and restore controls for the state it is in.',
    unit: [],
    integration: [],
    component: [],
    e2e: [],
    dimensions: [
      'client-state',
      'layout',
      'accessibility',
    ],
    rationale: 'Unproven until the component migration lands: no current case asserts the badge text, and the state machine behind it is proven at unit level (documents.list-row-state). This record is the placeholder the migration fills; it is deliberately not counted as covered.',
  },
  {
    id: 'documents.restore-notices',
    primary: 'e2e',
    behavior: 'A confirmed restoration removes the row, shows a focused restored status and keeps the unsubmitted search text; when the following refresh fails the alert is in viewport, bounded inside the panel and focused, the other rows unlock, and the same restore control stays inside the panel at narrow widths.',
    unit: [],
    integration: [],
    component: [],
    e2e: [
      {
        file: 'tests/browser/documents/document-list-boundaries.spec.ts',
        projects: both,
        title: 'confirmed restore survives refresh failure in en at 1440px',
      },
      {
        file: 'tests/browser/documents/document-list-boundaries.spec.ts',
        projects: both,
        title: 'confirmed restore survives refresh failure in zh at 320px',
      },
      {
        file: 'tests/browser/documents/document-list-boundaries.spec.ts',
        projects: both,
        title: 'trash retries a lost restoration response without restoring twice',
      },
    ],
    dimensions: [
      'layout',
      'focus',
      'idempotency',
      'i18n',
    ],
    rationale: 'Focus, in-viewport and panel bounds are the only facts here beyond the unit state machine (documents.restore-state). Two widths are kept because the two locales place the button differently; the intermediate 800, 390 and zh 1440 variants repeat identical assertions, and the app has no width breakpoint between 320 and 1440 except an appbar height at 1024px that this case does not read.',
  },
  {
    id: 'documents.restore-conflict-notices',
    primary: 'e2e',
    behavior: 'A restoration refused because the document changed names the change in the alert and recovers through its Refresh list button without a second write; the row then restores.',
    unit: [],
    integration: [],
    component: [],
    e2e: [
      {
        file: 'tests/browser/documents/document-list-boundaries.spec.ts',
        projects: both,
        title: 'trash conflict refreshes the list before another restore',
      },
    ],
    dimensions: ['error-mapping', 'focus'],
    rationale: 'The retry rule is unit-proven (documents.restore-conflict); what remains browser-owned is the alert copy and its button. The legacy map suggests moving this case to the component layer once that harness covers alerts.',
  },
  {
    id: 'documents.create-retry-navigation',
    primary: 'e2e',
    behavior: 'A creation whose response was lost is retried under the same key and the page then opens the single confirmed document, with the editor body rendered.',
    unit: [],
    integration: [],
    component: [],
    e2e: [
      {
        file: 'tests/browser/documents/document-list-boundaries.spec.ts',
        projects: both,
        title: 'creating after a lost response opens the single confirmed document on retry',
      },
    ],
    dimensions: ['idempotency', 'navigation'],
    rationale: 'The one-row and key-reuse rules are proven at integration (documents.create-replay) and unit level; navigating to /admin/documents/<id> and hydrating the editor there needs the router and the editor.',
  },
  {
    id: 'documents.late-create-navigation',
    primary: 'e2e',
    behavior: 'A creation acknowledgement that arrives after the operator left the list does not navigate: the new destination stays, and the document exists.',
    unit: [],
    integration: [],
    component: [],
    e2e: [
      {
        file: 'tests/browser/documents/document-list-navigation.spec.ts',
        projects: both,
        title: 'a late creation response preserves navigation away from the document list',
      },
    ],
    dimensions: ['navigation', 'client-state'],
    rationale: 'The controller guards navigation with a lifetime counter, but only a real route change and a second surface prove the guard as observed; the case holds the response across a link click.',
  },
  {
    id: 'documents.notice-accessibility',
    primary: 'e2e',
    behavior: 'The restoration error alert and the restored status are exposed and axe-clean for Chinese dark mode at 320px, with no document overflow.',
    unit: [],
    integration: [],
    component: [],
    e2e: [
      {
        describe: ['accessibility scanner'],
        file: 'tests/browser/documents/document-list-a11y.spec.ts',
        projects: both,
        title: 'restoration and refresh notices are accessible in zh at 320px',
      },
    ],
    dimensions: [
      'accessibility',
      'i18n',
      'layout',
    ],
    rationale: 'An axe scan plus computed overflow needs a rendered page. The zh variant is kept because it is the only one that also switches to dark mode and the narrow width; the en 1440 variant scans the same components with other strings.',
  },

  // ------------------------------------------------------------------------- catalog: rules
  {
    id: 'catalog.list-scope',
    primary: 'integration',
    behavior: 'One catalog list returns only its own kind, ordered by label then id, with strictly typed items (boolean retired, integer version) and 404 for a kind the API does not serve; the other kind may reuse a slug.',
    unit: [],
    integration: [
      {
        file: 'tests/integration/catalog.integration.ts',
        title: 'catalog lists stay scoped to one kind and keep their label order',
      },
    ],
    component: [],
    e2e: [],
    dimensions: [
      'ordering',
      'validation',
      'db-integrity',
    ],
    rationale: 'Kind scoping is one WHERE predicate over a shared table, and the ordering is SQL; the strict schema parse is what pins the retired boolean and the integer version.',
  },
  {
    id: 'catalog.access',
    primary: 'integration',
    behavior: 'Catalog writes need the same owner JWT, same-origin and CSRF token as document writes, and unknown, missing or out-of-range fields are 400 before any row is touched.',
    unit: [],
    integration: [
      {
        file: 'tests/integration/catalog.integration.ts',
        title: 'catalog writes require the document owner, origin and CSRF gate',
      },
    ],
    component: [],
    e2e: [],
    dimensions: ['access', 'validation'],
    rationale: 'The gate is shared code, but only this case shows the catalog routes actually reach it and that a strict create/update body is refused with INVALID_REQUEST; it also asserts the row count stays zero after the refusals.',
  },
  {
    id: 'catalog.create-replay',
    primary: 'integration',
    behavior: 'A catalog creation answers one entry per idempotency key, refuses the same key with another body as IDEMPOTENCY_KEY_REUSED, and refuses a slug already taken in that kind as 409.',
    unit: [],
    integration: [
      {
        file: 'tests/integration/catalog.integration.ts',
        title: 'catalog creation replays one entry per idempotency key and refuses its reuse',
      },
    ],
    component: [],
    e2e: [],
    dimensions: ['idempotency', 'db-integrity'],
    rationale: 'The case counts rows, so it proves the replay adds nothing. The duplicate-slug refusal currently surfaces the shared UNIQUE mapping as PUBLICATION_CONFLICT; the code name is recorded as a follow-up observation, not as a catalog contract.',
  },
  {
    id: 'catalog.update-version',
    primary: 'integration',
    behavior: 'A catalog update is guarded by expectedVersion inside its kind: success bumps the version once and replays under the same key, a stale version is 409 EDIT_CONFLICT, and the same id under the other kind cannot be updated.',
    unit: [],
    integration: [
      {
        file: 'tests/integration/catalog.integration.ts',
        title: 'catalog updates are version-guarded per kind and maintenance only pauses writes',
      },
    ],
    component: [],
    e2e: [],
    dimensions: [
      'version',
      'idempotency',
      'db-integrity',
    ],
    rationale: 'The guard condition and the version increment are inside the write transaction; the cross-kind refusal is what keeps two catalogs sharing one table apart.',
  },
  {
    id: 'catalog.maintenance',
    primary: 'integration',
    behavior: 'Maintenance refuses catalog creation and updates with 503 MAINTENANCE and keeps the catalog list readable.',
    unit: [],
    integration: [
      {
        file: 'tests/integration/catalog.integration.ts',
        title: 'catalog updates are version-guarded per kind and maintenance only pauses writes',
      },
    ],
    component: [],
    e2e: [],
    dimensions: ['maintenance'],
    rationale: 'Same shared guard as documents.maintenance, asserted on the catalog routes so a future route change cannot bypass it silently.',
  },
  {
    id: 'catalog.refresh-rebase',
    primary: 'unit',
    behavior: 'Refresh adopts every remote field into a clean form, adopts only untouched fields into a dirty form, and a read cannot reselect an old entry or overwrite a form started after it.',
    unit: [
      {
        file: 'tests/unit/catalog-form-state.test.ts',
        title: 'catalog refresh adopts all remote fields for a clean form',
      },
      {
        file: 'tests/unit/catalog-form-state.test.ts',
        title: 'catalog refresh preserves local edits while adopting untouched remote fields',
      },
      {
        file: 'tests/unit/catalog-session.test.ts',
        title: 'catalog refresh merges current edits with untouched remote fields and a newer version',
      },
      {
        file: 'tests/unit/catalog-session.test.ts',
        title: 'a catalog read cannot reselect an old entry or replace a new form',
      },
    ],
    integration: [],
    component: [],
    e2e: [],
    dimensions: ['client-state', 'concurrency'],
    rationale: 'Both rules are pure field merge plus a selection counter; the browser cases that render them (catalog.form-refresh-ui) add the Save affordance, not the merge.',
  },
  {
    id: 'catalog.save-ack',
    primary: 'unit',
    behavior: 'A confirmed save is accepted before the following read: it replaces the row in the loaded list without mutating or duplicating it, clears the form, and a failed read keeps the acknowledgement while reporting the load error.',
    unit: [
      {
        file: 'tests/unit/catalog-form-state.test.ts',
        title: 'catalog acknowledgement replaces its row without mutating or duplicating existing entries',
      },
      {
        file: 'tests/unit/catalog-session.test.ts',
        title: 'a confirmed catalog save survives a failed read and ignores an older read',
      },
    ],
    integration: [],
    component: [],
    e2e: [],
    dimensions: ['client-state', 'error-mapping'],
    rationale: 'Whether the acknowledgement lands before the refresh is a controller ordering decision, and the case proves the notice survives a failing read without resurrecting stale data.',
  },
  {
    id: 'catalog.save-key',
    primary: 'unit',
    behavior: 'An unconfirmed save keeps its idempotency key and target across a CSRF token update and view subscription changes, so the retry is the same write.',
    unit: [
      {
        file: 'tests/unit/catalog-session.test.ts',
        title: 'unknown catalog results retain their retry key across token updates and view subscriptions',
      },
      {
        file: 'tests/unit/catalog-session.test.ts',
        title: 'an in-flight catalog save keeps its target and finishes after its view unsubscribes',
      },
    ],
    integration: [],
    component: [],
    e2e: [],
    dimensions: ['idempotency', 'client-state'],
    rationale: 'The client owns the key and the target id; the Worker side of a replayed catalog write is catalog.create-replay and catalog.update-version.',
  },
  {
    id: 'catalog.clean-save',
    primary: 'unit',
    behavior: 'A clean form issues no write, so opening an entry and refreshing cannot bump its version.',
    unit: [
      {
        file: 'tests/unit/catalog-session.test.ts',
        title: 'a clean catalog form never writes',
      },
    ],
    integration: [],
    component: [],
    e2e: [],
    dimensions: ['client-state', 'idempotency'],
    rationale: 'A guard in save() that the disabled Save button cannot prove: the case asserts no request leaves the session at all.',
  },
  {
    id: 'catalog.session-isolation',
    primary: 'unit',
    behavior: 'Sessions are one per owner and kind: a browser keeps independent tag and series drafts, a different owner disposes the old ones, a server render never shares a form, disposal stops CSRF renewal and a dirty form warns before unload.',
    unit: [
      {
        file: 'tests/unit/catalog-session.test.ts',
        title: 'browser catalog sessions isolate kinds and owners and keep an unload warning while hidden',
      },
      {
        file: 'tests/unit/catalog-session.test.ts',
        title: 'server catalog sessions do not share form state between requests',
      },
      {
        file: 'tests/unit/catalog-session.test.ts',
        title: 'disposing a catalog session prevents CSRF renewal and replay of its in-flight save',
      },
    ],
    integration: [],
    component: [],
    e2e: [],
    dimensions: ['session-isolation', 'client-state'],
    rationale: 'Session identity, ownership and disposal are decided before rendering; the cases assert the map, the beforeunload listener and the absence of a second request.',
  },
  {
    id: 'catalog.selection-meta',
    primary: 'unit',
    behavior: 'Selecting catalog entries maps into document meta: tags keep their saved snapshots and never add a retired entry, series replaces the single choice, keeps its saved position and starts a new one at 1000.',
    unit: [
      {
        file: 'tests/unit/catalog-selection.test.ts',
        title: 'tag selection preserves saved snapshots and rejects retired additions',
      },
      {
        file: 'tests/unit/catalog-selection.test.ts',
        title: 'series selection replaces the choice, preserves its position and clears cleanly',
      },
    ],
    integration: [],
    component: [],
    e2e: [],
    dimensions: ['selection', 'client-state'],
    rationale: 'A pure function over meta and the loaded catalog; the editor controls that call it are covered by catalog.select-wiring.',
  },

  // -------------------------------------------------------------- catalog: browser wiring
  {
    id: 'catalog.form-refresh-ui',
    primary: 'e2e',
    behavior: 'Refreshing a clean catalog form shows the remote values with Save disabled and no unsaved marker; refreshing a dirty form keeps the typed name, adopts the remote slug and retired flag, and saves a version above the remote one.',
    unit: [],
    integration: [],
    component: [],
    e2e: [
      {
        file: 'tests/browser/catalog/catalog-boundaries.spec.ts',
        projects: both,
        title: 'refreshing a clean tag form adopts remote fields without marking it dirty',
      },
      {
        file: 'tests/browser/catalog/catalog-boundaries.spec.ts',
        projects: both,
        title: 'refreshing a dirty tag form preserves local edits and adopts untouched remote fields',
      },
      {
        file: 'tests/browser/catalog/catalog-boundaries.spec.ts',
        projects: both,
        title: 'a slow tag refresh cannot retarget a different entry\'s form',
      },
    ],
    dimensions: [
      'client-state',
      'focus',
      'version',
    ],
    rationale: 'The merge rule is unit-proven (catalog.refresh-rebase); these cases add the Save affordance, the unsaved marker and the PUT version the form sends. Only the tag variants are listed: tag and series share one session and one form, and the series variants assert the identical tree with other labels.',
  },
  {
    id: 'catalog.save-notices',
    primary: 'e2e',
    behavior: 'A confirmed creation stays visible when the following list read fails, its notice appears above the load error, and typing a new entry clears the notice; a refresh that lands during a new-entry save cannot turn it into an update.',
    unit: [],
    integration: [],
    component: [],
    e2e: [
      {
        file: 'tests/browser/catalog/catalog-boundaries.spec.ts',
        projects: both,
        title: 'a confirmed catalog creation stays visible when the list refresh fails',
      },
      {
        file: 'tests/browser/catalog/catalog-boundaries.spec.ts',
        projects: both,
        title: 'a slow refresh cannot turn a new catalog entry into an update of the old entry',
      },
    ],
    dimensions: [
      'client-state',
      'error-mapping',
      'navigation',
    ],
    rationale: 'The acknowledgement ordering is unit-proven (catalog.save-ack); what needs the page is that the POST goes to the collection while a held GET is in flight and that the status and alert render together. Both cases are component candidates in the legacy map.',
  },
  {
    id: 'catalog.retry-wiring',
    primary: 'e2e',
    behavior: 'An unknown creation is retried with its original key after a manual refresh and after browser history navigation, creating exactly one entry.',
    unit: [],
    integration: [],
    component: [],
    e2e: [
      {
        file: 'tests/browser/catalog/catalog-boundaries.spec.ts',
        projects: both,
        title: 'catalog retries an unknown creation after refreshing with the original idempotency key',
      },
      {
        file: 'tests/browser/catalog/catalog-navigation.spec.ts',
        projects: both,
        title: 'an unknown catalog creation retries its original request after browser history navigation',
      },
    ],
    dimensions: ['idempotency', 'navigation'],
    rationale: 'Key retention is unit-proven (catalog.save-key); these cases prove the form remains dirty and the key survives a refresh and a back/forward trip, which only the real page can show.',
  },
  {
    id: 'catalog.kind-switch',
    primary: 'e2e',
    behavior: 'Switching to the other catalog starts an empty form, and tag and series drafts stay independent while traversing the same history.',
    unit: [],
    integration: [],
    component: [],
    e2e: [
      {
        file: 'tests/browser/catalog/catalog-navigation.spec.ts',
        projects: both,
        title: 'switching a clean catalog form to the other catalog starts an empty form',
      },
      {
        file: 'tests/browser/catalog/catalog-navigation.spec.ts',
        projects: both,
        title: 'tags and series keep independent drafts while traversing the same browser history',
      },
    ],
    dimensions: ['session-isolation', 'navigation'],
    rationale: 'Per-kind isolation is unit-proven (catalog.session-isolation); the page adds the route change and its effect on the visible form.',
  },
  {
    id: 'catalog.navigation-guard',
    primary: 'e2e',
    behavior: 'A dirty catalog form asks before leaving, cancel and Escape return to the form with focus back on the trigger, an in-flight save makes the dialog wait, and confirming lands on the other catalog with an empty form.',
    unit: [],
    integration: [],
    component: [],
    e2e: [
      {
        file: 'tests/browser/catalog/catalog-navigation.spec.ts',
        projects: both,
        title: 'catalog navigation asks before discarding at 1440px',
      },
      {
        file: 'tests/browser/catalog/catalog-navigation.spec.ts',
        projects: both,
        title: 'catalog navigation asks before discarding at 320px',
      },
      {
        file: 'tests/browser/catalog/catalog-navigation.spec.ts',
        projects: both,
        title: 'catalog navigation waits for an in-flight save before leaving',
      },
    ],
    dimensions: ['navigation', 'focus'],
    rationale: 'Both widths are kept because the trigger differs: 1440px uses a navigation link, 320px an overflow menu, and focus returns to different elements. The dialog and focus ownership exist only in a live route transition.',
  },
  {
    id: 'catalog.history-draft',
    primary: 'e2e',
    behavior: 'A dirty catalog draft survives a browser back/forward round trip with no dialog and no history growth, and returns with its fields and an enabled Save.',
    unit: [],
    integration: [],
    component: [],
    e2e: [
      {
        file: 'tests/browser/catalog/catalog-navigation.spec.ts',
        projects: both,
        title: 'catalog draft survives browser back and returning without changing history',
      },
    ],
    dimensions: ['navigation', 'client-state'],
    rationale: 'History length, a suppressed dialog and a restored form are browser facts. The forward direction runs the same guard with mirrored calls; the legacy map drops it as a duplicate and keeps the back direction.',
  },
  {
    id: 'catalog.save-busy',
    primary: 'e2e',
    behavior: 'A save stays busy through browser navigation: the form returns disabled with its typed value and the Saving control, then shows the confirmation and the new row while only one PUT was observed.',
    unit: [],
    integration: [],
    component: [],
    e2e: [
      {
        file: 'tests/browser/catalog/catalog-navigation.spec.ts',
        projects: both,
        title: 'a catalog save stays busy through browser navigation and only updates its original form',
      },
    ],
    dimensions: ['client-state', 'navigation'],
    rationale: 'The in-flight target is unit-proven (catalog.save-key); the page adds the disabled fields after returning and the single observed request.',
  },
  {
    id: 'catalog.select-wiring',
    primary: 'e2e',
    behavior: 'The editor catalog selects search as the operator types, allow several tags, replace the single series, refuse a retired tag while keeping saved selections, and retry a failed read inside the popup.',
    unit: [],
    integration: [],
    component: [],
    e2e: [
      {
        file: 'tests/browser/catalog/catalog-controls-polish.spec.ts',
        projects: both,
        title: 'catalog Selects search, support multiple tags and replace series',
      },
      {
        file: 'tests/browser/catalog/catalog-controls-polish.spec.ts',
        projects: both,
        title: 'catalog failures keep existing selections visible and retry within the searchable Select',
      },
      {
        file: 'tests/browser/catalog/catalog-controls-polish.spec.ts',
        projects: both,
        title: 'search composition commits text without selecting a catalog option or closing its Select',
      },
    ],
    dimensions: [
      'selection',
      'focus',
      'error-mapping',
    ],
    rationale: 'These are editor-surface cases and belong to the editor slice; they are listed here because the catalog selection rule (catalog.selection-meta) is only rendered through them. IME composition cannot be produced without a browser.',
  },
  {
    id: 'catalog.select-accessibility',
    primary: 'e2e',
    behavior: 'The catalog selects and their popups are axe-clean, fit the mobile settings drawer with Chinese labels, and the Chinese dark navigation dialog keeps the draft and returns focus at 320px.',
    unit: [],
    integration: [],
    component: [],
    e2e: [
      {
        file: 'tests/browser/catalog/catalog-controls-polish.spec.ts',
        projects: both,
        title: 'catalog Select fits the mobile settings drawer and uses Chinese labels',
      },
      {
        describe: ['catalog accessibility scanner'],
        file: 'tests/browser/catalog/catalog-controls-polish.spec.ts',
        projects: both,
        title: 'searchable catalog popups and checked shared Checkbox have no axe violations',
      },
      {
        describe: ['accessibility scanner'],
        file: 'tests/browser/catalog/catalog-boundary-a11y.spec.ts',
        projects: both,
        title: 'Chinese dark catalog navigation preserves the draft and returns focus at 320px',
      },
    ],
    dimensions: [
      'accessibility',
      'i18n',
      'layout',
      'focus',
    ],
    rationale: 'Axe, drawer bounds and focus restoration need a rendered page in both locales.',
  },
] as const satisfies readonly DocumentsCatalogContract[]

export type LegacyCaseSuggestion = {
  readonly describe?: readonly string[]
  readonly file: string
  /** `drop` means the assertions are covered by another case or by a rule layer; the note names it. */
  readonly suggestedLayer: 'component' | 'drop' | 'e2e' | 'split'
  readonly title: string
  readonly note: string
}

/**
 * Layer decision for every documents/catalog browser case that exists today. The migration deletes a
 * `drop` case, converts a `component` case, keeps an `e2e` case, and decides a `split` case itself.
 * Widths and kinds are only dropped where the remaining variant reads the same assertions.
 */
export const documentsCatalogLegacyCases = [
  {
    file: 'tests/browser/documents/documents.spec.ts',
    suggestedLayer: 'split',
    title: 'documents retry, filter, recover trash and keep bilingual mobile UI',
    note: 'Filter chips, combobox filtering, the retry banner and the trashed-row restore control are component material; the 390px Chinese no-overflow measure and the real restore acknowledgement are the parts worth keeping at browser level.',
  },
  {
    describe: ['accessibility scanner'],
    file: 'tests/browser/documents/document-list-a11y.spec.ts',
    suggestedLayer: 'drop',
    title: 'restoration and refresh notices are accessible in en at 1440px',
    note: 'Scans the same tree with English strings; the zh 320 variant adds dark mode and the narrow width.',
  },
  {
    describe: ['accessibility scanner'],
    file: 'tests/browser/documents/document-list-a11y.spec.ts',
    suggestedLayer: 'e2e',
    title: 'restoration and refresh notices are accessible in zh at 320px',
    note: 'Cited by documents.notice-accessibility; the only axe scan of the trash notices in dark mode at the narrow width.',
  },
  {
    file: 'tests/browser/documents/document-list-boundaries.spec.ts',
    suggestedLayer: 'e2e',
    title: 'confirmed restore survives refresh failure in en at 1440px',
    note: 'Cited by documents.restore-notices as the Latin, wide variant.',
  },
  {
    file: 'tests/browser/documents/document-list-boundaries.spec.ts',
    suggestedLayer: 'drop',
    title: 'confirmed restore survives refresh failure in en at 800px',
    note: 'Same assertions as the en 1440 variant. The only width breakpoint in the app (1024px) changes the appbar height, which this case does not read; reinstate a mid-width variant if a list layout contract appears between the extremes.',
  },
  {
    file: 'tests/browser/documents/document-list-boundaries.spec.ts',
    suggestedLayer: 'drop',
    title: 'confirmed restore survives refresh failure in zh at 1440px',
    note: 'Chinese copy is already read at 320px, where the panel is narrower.',
  },
  {
    file: 'tests/browser/documents/document-list-boundaries.spec.ts',
    suggestedLayer: 'drop',
    title: 'confirmed restore survives refresh failure in zh at 390px',
    note: 'Same assertions as zh 320 with more room; 320 is the tighter fit and also the viewport where the restore control can overflow.',
  },
  {
    file: 'tests/browser/documents/document-list-boundaries.spec.ts',
    suggestedLayer: 'e2e',
    title: 'confirmed restore survives refresh failure in zh at 320px',
    note: 'Cited by documents.restore-notices as the CJK, narrow variant.',
  },
  {
    file: 'tests/browser/documents/document-list-boundaries.spec.ts',
    suggestedLayer: 'e2e',
    title: 'pagination reveals its failure and retries the same page without duplicating loaded rows',
    note: 'Cited by documents.list-pagination-ui; alert focus and viewport position are browser-only.',
  },
  {
    file: 'tests/browser/documents/document-list-boundaries.spec.ts',
    suggestedLayer: 'e2e',
    title: 'trash retries a lost restoration response without restoring twice',
    note: 'Cited by documents.restore-notices; the abort-after-commit wiring exists only behind the page route.',
  },
  {
    file: 'tests/browser/documents/document-list-boundaries.spec.ts',
    suggestedLayer: 'component',
    title: 'trash conflict refreshes the list before another restore',
    note: 'The rule is now unit-proven (documents.restore-conflict); the alert copy, its Refresh list button and the absence of a second write belong to the component layer.',
  },
  {
    file: 'tests/browser/documents/document-list-boundaries.spec.ts',
    suggestedLayer: 'e2e',
    title: 'creating after a lost response opens the single confirmed document on retry',
    note: 'Cited by documents.create-retry-navigation; the final navigation and editor hydration cannot be observed elsewhere.',
  },
  {
    file: 'tests/browser/documents/document-list-hydration.spec.ts',
    suggestedLayer: 'e2e',
    title: 'the search form stays disabled until hydration and opens before the list answers',
    note: 'Cited by documents.list-hydration; needs a real server render plus a deferred chunk.',
  },
  {
    file: 'tests/browser/documents/document-list-navigation.spec.ts',
    suggestedLayer: 'e2e',
    title: 'a late creation response preserves navigation away from the document list',
    note: 'Cited by documents.late-create-navigation.',
  },
  {
    file: 'tests/browser/documents/document-list-navigation.spec.ts',
    suggestedLayer: 'drop',
    title: '120-character en search chips fit at 320px and can be removed',
    note: 'Same assertions as the zh variant, whose wide glyphs are the tighter fit for the ellipsis and the icon.',
  },
  {
    file: 'tests/browser/documents/document-list-navigation.spec.ts',
    suggestedLayer: 'e2e',
    title: '120-character zh search chips fit at 320px and can be removed',
    note: 'Cited by documents.list-chip-layout; the measured overflow and ellipsis need a rendered chip.',
  },
  {
    file: 'tests/browser/documents/document-list-readiness.spec.ts',
    suggestedLayer: 'e2e',
    title: 'list readiness does not wait for an unrelated request that never answers',
    note: 'Cited by documents.list-readiness; holds a real prefetch open while the list reports ready.',
  },
  {
    file: 'tests/browser/documents/document-list-readiness.spec.ts',
    suggestedLayer: 'e2e',
    title: 'a prefetch that never answers cannot hold the surface hostage',
    note: 'Cited by documents.list-readiness; asserts the deadline return of the pre-unload wait.',
  },
  {
    file: 'tests/browser/documents/document-list-readiness.spec.ts',
    suggestedLayer: 'e2e',
    title: 'the pre-unload deadline also bounds a paint that never completes',
    note: 'Cited by documents.list-readiness; requires a page whose requestAnimationFrame can be replaced.',
  },
  {
    file: 'tests/browser/documents/document-loading-polish.spec.ts',
    suggestedLayer: 'drop',
    title: 'document loading and refresh stay readable in en at 1440px',
    note: 'Same assertions as the zh 320 variant, which additionally scans accessibility and reads the narrow layout.',
  },
  {
    file: 'tests/browser/documents/document-loading-polish.spec.ts',
    suggestedLayer: 'e2e',
    title: 'document loading and refresh stay readable in zh at 320px',
    note: 'Cited by documents.list-loading-surface; measures indicator geometry and collects page errors.',
  },
  {
    file: 'tests/browser/documents/document-loading-polish.spec.ts',
    suggestedLayer: 'e2e',
    title: 'a cancelled-prefetch message stays a failure on the loading surface',
    note: 'Cited by documents.list-loading-surface; proves no error text is excused.',
  },
  {
    file: 'tests/browser/catalog/catalog-boundaries.spec.ts',
    suggestedLayer: 'e2e',
    title: 'a slow tag refresh cannot retarget a different entry\'s form',
    note: 'Cited by catalog.form-refresh-ui; the held-GET wiring keeps the form pointed at its target.',
  },
  {
    file: 'tests/browser/catalog/catalog-boundaries.spec.ts',
    suggestedLayer: 'drop',
    title: 'a slow series refresh cannot retarget a different entry\'s form',
    note: 'Identical assertions; tag proves the session rule, and the kinds share one session and one form.',
  },
  {
    file: 'tests/browser/catalog/catalog-boundaries.spec.ts',
    suggestedLayer: 'e2e',
    title: 'refreshing a clean tag form adopts remote fields without marking it dirty',
    note: 'Cited by catalog.form-refresh-ui while the Save affordance is browser-owned; convert with that contract.',
  },
  {
    file: 'tests/browser/catalog/catalog-boundaries.spec.ts',
    suggestedLayer: 'drop',
    title: 'refreshing a clean series form adopts remote fields without marking it dirty',
    note: 'Identical assertions to the tag variant.',
  },
  {
    file: 'tests/browser/catalog/catalog-boundaries.spec.ts',
    suggestedLayer: 'e2e',
    title: 'refreshing a dirty tag form preserves local edits and adopts untouched remote fields',
    note: 'Cited by catalog.form-refresh-ui; also reads the version the form sends.',
  },
  {
    file: 'tests/browser/catalog/catalog-boundaries.spec.ts',
    suggestedLayer: 'drop',
    title: 'refreshing a dirty series form preserves local edits and adopts untouched remote fields',
    note: 'Identical assertions to the tag variant.',
  },
  {
    file: 'tests/browser/catalog/catalog-boundaries.spec.ts',
    suggestedLayer: 'e2e',
    title: 'a confirmed catalog creation stays visible when the list refresh fails',
    note: 'Cited by catalog.save-notices; convert to the component layer when it owns the notices.',
  },
  {
    file: 'tests/browser/catalog/catalog-boundaries.spec.ts',
    suggestedLayer: 'e2e',
    title: 'a slow refresh cannot turn a new catalog entry into an update of the old entry',
    note: 'Cited by catalog.save-notices; the request the form sends while a refresh is held is browser-observable only.',
  },
  {
    file: 'tests/browser/catalog/catalog-boundaries.spec.ts',
    suggestedLayer: 'e2e',
    title: 'catalog retries an unknown creation after refreshing with the original idempotency key',
    note: 'Cited by catalog.retry-wiring.',
  },
  {
    describe: ['accessibility scanner'],
    file: 'tests/browser/catalog/catalog-boundary-a11y.spec.ts',
    suggestedLayer: 'e2e',
    title: 'Chinese dark catalog navigation preserves the draft and returns focus at 320px',
    note: 'Cited by catalog.select-accessibility; axe plus focus restoration in the Chinese dark navigation dialog.',
  },
  {
    file: 'tests/browser/catalog/catalog-controls-polish.spec.ts',
    suggestedLayer: 'e2e',
    title: 'catalog Selects search, support multiple tags and replace series',
    note: 'Cited by catalog.select-wiring. Editor-surface case: it belongs to the editor slice, not to this reorganization.',
  },
  {
    file: 'tests/browser/catalog/catalog-controls-polish.spec.ts',
    suggestedLayer: 'e2e',
    title: 'catalog failures keep existing selections visible and retry within the searchable Select',
    note: 'Cited by catalog.select-wiring. Editor-surface case.',
  },
  {
    file: 'tests/browser/catalog/catalog-controls-polish.spec.ts',
    suggestedLayer: 'e2e',
    title: 'search composition commits text without selecting a catalog option or closing its Select',
    note: 'Cited by catalog.select-wiring; IME composition exists only in a browser.',
  },
  {
    file: 'tests/browser/catalog/catalog-controls-polish.spec.ts',
    suggestedLayer: 'e2e',
    title: 'catalog Select fits the mobile settings drawer and uses Chinese labels',
    note: 'Cited by catalog.select-accessibility; the drawer and Chinese labels are editor surface.',
  },
  {
    describe: ['catalog accessibility scanner'],
    file: 'tests/browser/catalog/catalog-controls-polish.spec.ts',
    suggestedLayer: 'e2e',
    title: 'searchable catalog popups and checked shared Checkbox have no axe violations',
    note: 'Cited by catalog.select-accessibility.',
  },
  {
    file: 'tests/browser/catalog/catalog-navigation.spec.ts',
    suggestedLayer: 'e2e',
    title: 'switching a clean catalog form to the other catalog starts an empty form',
    note: 'Cited by catalog.kind-switch.',
  },
  {
    file: 'tests/browser/catalog/catalog-navigation.spec.ts',
    suggestedLayer: 'e2e',
    title: 'catalog navigation asks before discarding at 1440px',
    note: 'Cited by catalog.navigation-guard; the wide trigger is a navigation link.',
  },
  {
    file: 'tests/browser/catalog/catalog-navigation.spec.ts',
    suggestedLayer: 'e2e',
    title: 'catalog navigation asks before discarding at 320px',
    note: 'Cited by catalog.navigation-guard; the narrow trigger is an overflow menu item and focus returns to that button.',
  },
  {
    file: 'tests/browser/catalog/catalog-navigation.spec.ts',
    suggestedLayer: 'e2e',
    title: 'catalog navigation waits for an in-flight save before leaving',
    note: 'Cited by catalog.navigation-guard.',
  },
  {
    file: 'tests/browser/catalog/catalog-navigation.spec.ts',
    suggestedLayer: 'e2e',
    title: 'catalog draft survives browser back and returning without changing history',
    note: 'Cited by catalog.history-draft.',
  },
  {
    file: 'tests/browser/catalog/catalog-navigation.spec.ts',
    suggestedLayer: 'drop',
    title: 'catalog draft survives browser forward and returning without changing history',
    note: 'Runs the same guard with mirrored history calls; the back direction is kept.',
  },
  {
    file: 'tests/browser/catalog/catalog-navigation.spec.ts',
    suggestedLayer: 'e2e',
    title: 'an unknown catalog creation retries its original request after browser history navigation',
    note: 'Cited by catalog.retry-wiring.',
  },
  {
    file: 'tests/browser/catalog/catalog-navigation.spec.ts',
    suggestedLayer: 'e2e',
    title: 'a catalog save stays busy through browser navigation and only updates its original form',
    note: 'Cited by catalog.save-busy.',
  },
  {
    file: 'tests/browser/catalog/catalog-navigation.spec.ts',
    suggestedLayer: 'e2e',
    title: 'tags and series keep independent drafts while traversing the same browser history',
    note: 'Cited by catalog.kind-switch.',
  },
] as const satisfies readonly LegacyCaseSuggestion[]
