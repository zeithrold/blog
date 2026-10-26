export type SuiteDeclarationSource = 'first-generation' | 'baseline' | 'declaration-site'

export type SuiteDeclaration = {
  readonly describe: readonly string[]
  readonly source: SuiteDeclarationSource
  readonly file?: string
  readonly line?: number
  readonly note?: string
}

/* eslint-disable style/max-len, max-lines -- One declaration site per line: the literal case key, its line and its suite path; the table is data, so it grows with the register. */
/*
 * Retained browser cases whose suite path no first-generation record declares.
 *
 * These are the E2E cases that were never rewritten into a component record, so
 * `componentMigrations`, `surfaceMigrations`, the contract baseline and the
 * history server proofs all say nothing about where the case sits. Asking the
 * `--list` output would answer the gate's question with the gate's own input, so
 * each entry is instead recorded once, by hand, from the declaration site in the
 * spec source: the `file` and `line` of the `test(...)` registration, and the
 * `describe` chain that encloses it. A reviewer can open that line and check the
 * path without running anything, and a case that is later re-nested shows up as
 * a mismatch instead of silently re-defining its own expectation.
 *
 * A file-scope `for` loop registers several cases from one `test(...)` line, so
 * entries sharing a file and line are noted as one registration site rather than
 * being mistaken for duplicates.
 *
 * Two retained identities that could not be named here are now fixed in the data
 * rather than excused: `tests/browser/history/history-interleaving.spec.ts` was a
 * bare file and is now seven named cases, and the presentation accessibility case
 * was one title across six describe suites and now carries its width and locale.
 * Every retained non-DOM ledger key therefore has a declaration, and no entry in
 * this table exists to excuse a gap.
 */
type DeclarationSite = readonly [
  key: string,
  line: number,
  describe?: readonly string[],
]

const declarationSites: readonly DeclarationSite[] = [
  [
    'tests/browser/admin/admin-management.spec.ts :: global media uploads remain private and operations show real counters',
    140,
  ],
  [
    'tests/browser/editor/blocks/block-color-drawer.spec.ts :: color drawer fits 320px in en and persists both colors on the selected block',
    47,
    ['touch block colors'],
  ],
  [
    'tests/browser/editor/blocks/mobile-block-gap.spec.ts :: the gap add control inserts after its block and deletion preserves its neighbours',
    22,
    ['touch controls in the block gap'],
  ],
  [
    'tests/browser/editor/formatting/format-toolbar-input.spec.ts :: touch taps preserve a partial selection through bold and the mobile color drawer',
    65,
    ['touch formatting input'],
  ],
  [
    'tests/browser/editor/formatting/format-toolbar.spec.ts :: floating formatting is bounded at 1440px in en and bold affects only its selected range',
    120,
  ],
  [
    'tests/browser/editor/formatting/format-toolbar.spec.ts :: floating formatting is bounded at 320px in zh and bold affects only its selected range',
    120,
  ],
  [
    'tests/browser/editor/formatting/format-toolbar.spec.ts :: mobile advanced formatting preserves selection and native actions at 390px',
    172,
  ],
  [
    'tests/browser/editor/links/link-extra-entry.spec.ts :: a relative link keeps its destination in the published reader',
    17,
  ],
  [
    'tests/browser/editor/links/link-lifecycle.spec.ts :: a delayed dialog link close leaves the destination input alone',
    7,
  ],
  [
    'tests/browser/editor/links/link-normalization.spec.ts :: links validate and normalize destinations at 1440px in en',
    19,
  ],
  [
    'tests/browser/editor/links/link-targets.spec.ts :: unlink keeps URL-shaped text unlinked after saving and reloading',
    10,
  ],
  [
    'tests/browser/editor/mobile-editor-actions.spec.ts :: mobile publish drains pending edits and exposes the live document and unpublish through the drawer',
    93,
  ],
  [
    'tests/browser/editor/mobile-editor-actions.spec.ts :: mobile sync remains disabled when a draft requires conflict resolution',
    140,
  ],
  [
    'tests/browser/editor/mobile-editor-actions.spec.ts :: mobile sync writes pending changes privately and autosave remains independent',
    56,
  ],
  [
    'tests/browser/editor/overlays/editor-overlay-races.spec.ts :: a delayed mobile publication locator leaves the new route and input alone',
    9,
  ],
  [
    'tests/browser/editor/source/code-language.spec.ts :: an unknown saved code language remains intact until the author selects another language',
    134,
  ],
  [
    'tests/browser/editor/source/code-language.spec.ts :: code language persists through save reload and reader preview at 1440px',
    104,
  ],
  [
    'tests/browser/editor/source/code-language.spec.ts :: code language persists through save reload and reader preview at 390px',
    104,
  ],
  ['tests/browser/editor/source/code-language.spec.ts :: code source and language survive save reload at 1440px', 70],
  ['tests/browser/editor/source/code-language.spec.ts :: code source and language survive save reload at 390px', 70],
  [
    'tests/browser/editor/source/code-language.spec.ts :: remains compact and usable after a publication lock',
    156,
    ['touch code language control'],
  ],
  [
    'tests/browser/editor/source/formula-editor.spec.ts :: display formula rows and multiline source roundtrip at 1440px',
    147,
  ],
  [
    'tests/browser/editor/source/formula-editor.spec.ts :: display formula rows and multiline source roundtrip at 390px',
    147,
  ],
  ['tests/browser/editor/source/formula-editor.spec.ts :: new block formulas receive typing immediately at 1440px', 88],
  ['tests/browser/editor/source/formula-editor.spec.ts :: new block formulas receive typing immediately at 390px', 88],
  [
    'tests/browser/editor/source/source-input.spec.ts :: Delete at the end of a math source preserves the following paragraph',
    9,
  ],
  [
    'tests/browser/editor/tables/formatting-table-position.spec.ts :: table formatting preserves its range below the selection at 390px',
    7,
  ],
  [
    'tests/browser/editor/tables/table-caption.spec.ts :: each table has an independent caption below its viewport at 390px',
    29,
  ],
  [
    'tests/browser/editor/tables/table-overlay-polish.spec.ts :: native slash table keeps unset widths through middle insertion and reload',
    4,
  ],
  [
    'tests/browser/history/conflict.spec.ts :: two tabs preserve conflicting content and require a focused explicit replacement dialog',
    6,
  ],
  [
    'tests/browser/history/editor-history-boundaries.spec.ts :: a failed browser traversal can explicitly leave without adding history',
    32,
  ],
  [
    'tests/browser/history/editor-history-boundaries.spec.ts :: a failed browser traversal can retry saving without adding history',
    32,
  ],
  [
    'tests/browser/history/editor-history-boundaries.spec.ts :: a history branch and multi-step traversal use actual positions despite router index gaps',
    142,
  ],
  [
    'tests/browser/history/editor-history-boundaries.spec.ts :: a newer opposite traversal replaces the destination during a save',
    64,
  ],
  [
    'tests/browser/history/editor-history-boundaries.spec.ts :: cancel and Escape keep the editor at its history entry despite a late save',
    7,
  ],
  [
    'tests/browser/history/editor-history-boundaries.spec.ts :: leaving across a native hash entry saves first and restores the full traversal distance',
    106,
  ],
  [
    'tests/browser/history/editor-history-boundaries.spec.ts :: rapid repeated Back requests can be cancelled without a late history jump',
    87,
  ],
  [
    'tests/browser/history/editor-history-boundaries.spec.ts :: same-document query history receives the save guard and does not add a route entry',
    127,
  ],
  ['tests/browser/history/editor-history-focus.spec.ts :: mobile cancellation returns to the edited title', 6],
  ['tests/browser/history/editor-history-focus.spec.ts :: mobile cancellation returns to the menu trigger', 6],
  [
    'tests/browser/history/editor-history-upload.spec.ts :: a queued file blocks browser traversal and remains available after staying',
    58,
  ],
  ['tests/browser/history/editor-history-upload.spec.ts :: immediate paste upload handles history cancellation', 7],
  ['tests/browser/history/editor-history-upload.spec.ts :: immediate paste upload handles history departure', 7],
  [
    'tests/browser/history/history.spec.ts :: history compares stable blocks, restores a new head and publishes a selected historical revision',
    5,
  ],
  [
    'tests/browser/history/history-interleaving.spec.ts :: two destination pops before restoration preserve the latest Back destination',
    17,
  ],
  [
    'tests/browser/history/history-interleaving.spec.ts :: Stay here during a second restoration cancels that traversal before its repair arrives',
    50,
  ],
  [
    'tests/browser/history/history-interleaving.spec.ts :: a delayed approved traversal cannot displace a newer clean browser destination',
    80,
  ],
  [
    'tests/browser/history/history-interleaving.spec.ts :: legacy history restores, cancels and saves an ordinary Back traversal',
    110,
  ],
  [
    'tests/browser/history/history-interleaving.spec.ts :: returning to the source during restoration dismisses the pending departure',
    136,
  ],
  [
    'tests/browser/history/history-interleaving.spec.ts :: a history request supersedes an earlier internal link before restoration completes',
    160,
  ],
  [
    'tests/browser/history/history-interleaving.spec.ts :: a branch write drains its rejected repair and later history still works',
    187,
  ],
  [
    'tests/browser/history/preview-history-polish.spec.ts :: the historical preview entry opens the stored revision in a new tab',
    9,
  ],
  [
    'tests/browser/journeys/presentation.spec.ts :: accessibility scanner: late controls retain layout, focus and interaction contracts at 320px in en',
    65,
    ['presentation journey 320px en'],
  ],
  [
    'tests/browser/journeys/presentation.spec.ts :: accessibility scanner: late controls retain layout, focus and interaction contracts at 320px in zh',
    65,
    ['presentation journey 320px zh'],
  ],
  [
    'tests/browser/journeys/presentation.spec.ts :: accessibility scanner: late controls retain layout, focus and interaction contracts at 390px in en',
    65,
    ['presentation journey 390px en'],
  ],
  [
    'tests/browser/journeys/presentation.spec.ts :: accessibility scanner: late controls retain layout, focus and interaction contracts at 390px in zh',
    65,
    ['presentation journey 390px zh'],
  ],
  [
    'tests/browser/journeys/presentation.spec.ts :: accessibility scanner: late controls retain layout, focus and interaction contracts at 1440px in en',
    65,
    ['presentation journey 1440px en'],
  ],
  [
    'tests/browser/journeys/presentation.spec.ts :: accessibility scanner: late controls retain layout, focus and interaction contracts at 1440px in zh',
    65,
    ['presentation journey 1440px zh'],
  ],
  [
    'tests/browser/journeys/publication.spec.ts :: long task: fix preflight, pin and cancel schedules, recover authentication and resume maintenance',
    22,
  ],
  [
    'tests/browser/media/editor-media-flow.spec.ts :: media replacement preserves the block and descriptions at 1440px',
    12,
  ],
  [
    'tests/browser/media/editor-media-flow.spec.ts :: media replacement preserves the block and descriptions at 390px',
    12,
  ],
  [
    'tests/browser/publication/publication-errors.spec.ts :: correcting a rejected draft clears its reasons and publishes the saved content',
    9,
  ],
  [
    'tests/browser/publication/publication-locate-boundaries.spec.ts :: unpublishing preserves the unresolved draft rejection and its locator',
    5,
  ],
  [
    'tests/browser/publication/publication-locate.spec.ts :: publication preserves reasons and locates each table at 1440px in en',
    7,
  ],
  [
    'tests/browser/publication/publication-locate.spec.ts :: publication preserves reasons and locates each table at 1440px in zh',
    7,
  ],
  [
    'tests/browser/publication/publication-locate.spec.ts :: publication preserves reasons and locates each table at 320px in en',
    7,
  ],
  [
    'tests/browser/publication/publication-locate.spec.ts :: publication preserves reasons and locates each table at 320px in zh',
    7,
  ],
  [
    'tests/browser/reader/public-reader.spec.ts :: article contents reveal nested details and continue keyboard reading at the selected heading',
    118,
  ],
  [
    'tests/browser/reader/typography.spec.ts :: reader headings, list markers and highlighted code survive preview and publication at 1440px',
    100,
  ],
  [
    'tests/browser/reader/typography.spec.ts :: reader headings, list markers and highlighted code survive preview and publication at 390px',
    100,
  ],
  [
    'tests/browser/reader/typography.spec.ts :: reader headings, list markers and highlighted code survive preview and publication at 320px',
    100,
  ],
  [
    'tests/browser/references/reference-drawer-page.spec.ts :: touch dragging sorts authors without dismissing the drawer',
    8,
  ],
  [
    'tests/browser/references/reference-settings.spec.ts :: reference drafts save explicitly and keep cited records intact at 390px',
    48,
  ],
]

/** The spec a declaration was read from; the key always names it, so never trust a separate string. */
function declarationFile(key: string): string {
  const separator = key.indexOf(' :: ')
  if (separator < 0) {
    throw new Error(`A declaration site must name a case, never a file: ${key}`)
  }
  return key.slice(0, separator)
}

/** A file-scope loop registers several cases from one `test(...)` line. */
const sharedSites = new Map<string, number>()
for (const [key, line] of declarationSites) {
  const site = `${declarationFile(key)}:${line}`
  sharedSites.set(site, (sharedSites.get(site) ?? 0) + 1)
}

/** Explicit suite paths supplement first-generation declarations; `[]` means top level. */
export const suiteDeclarations: ReadonlyMap<string, SuiteDeclaration> = new Map(
  declarationSites.map(([key, line, describe = []]): [string, SuiteDeclaration] => {
    const file = declarationFile(key)
    const shape = describe.length === 0
      ? 'top-level test registration'
      : `inside describe ${describe.join(' / ')}`
    const shared = (sharedSites.get(`${file}:${line}`) ?? 0) > 1
      ? 'one file-scope registration site produces several cases; '
      : ''
    return [
      key,
      {
        describe,
        source: 'declaration-site',
        file,
        line,
        note: `${shared}${shape}`,
      },
    ]
  }),
)
