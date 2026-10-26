/* eslint-disable style/max-len -- One row per registered Playwright case, with verbatim references on one line. */
/**
 * Where each remaining history Playwright case goes, and what survives in a browser.
 *
 * The eight fully retired component cases are recorded in
 * `tests/contracts/dom-migrations.ts`, which names their exact jsdom successors and
 * proves each retired case is gone from the component plan. This table keeps the
 * nine split cases that still run: their `dom` entries name the jsdom cases that
 * now prove the content, and `remainsBrowser` names the precise residual only a
 * browser can hold — geometry, 44px targets, painted SVG icons, native focus
 * delivery and the real Worker/D1. The editor preview/conflict cases with no jsdom
 * successor are listed with the native fact that keeps them.
 *
 * This file is data, not a test: `vitest.dom.config.ts` includes only the
 * `*.test.tsx` files under `tests/dom`, and this file is not one of them.
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

const e2ePage = 'tests/browser/history/history.spec.ts'
const e2eInterleaving = 'tests/browser/history/history-interleaving.spec.ts'
const conflict = 'tests/components/specs/history-conflict.spec.ts'
const requirements = 'tests/components/specs/history-requirements.spec.ts'
const compare = 'tests/components/specs/editor-history-remaining-compare.spec.ts'
const editorConflict = 'tests/components/specs/editor-history-remaining-conflict.spec.ts'
const preview = 'tests/components/specs/editor-history-remaining-preview.spec.ts'
const a11y = 'tests/components/specs/editor-history-remaining-a11y.spec.ts'
const selection = 'tests/dom/history-state-selection.test.tsx'
const panel = 'tests/dom/history-state-editor-history.test.tsx'
const conflictRemaining = 'tests/dom/history-conflict-remaining.test.tsx'
const previewEntries = 'tests/dom/history-preview-remaining-entries.test.tsx'
const previewRecovery = 'tests/dom/history-preview-remaining-recovery.test.tsx'

function at(file: string, title: string): string {
  return `${file} :: ${title}`
}

const widths = [
  320,
  390,
  1440,
]
const narrow = [320, 390]
const conflictAccessible = [
  { width: 320, locale: 'zh' },
  { width: 1440, locale: 'en' },
]
const scanned = [390, 1440]
const locales = ['en', 'zh'] as const

const pageRetirements: readonly DomRetirement[] = [
  {
    playwright: at(conflict, 'history CAS conflict refreshes the baseline and preserves the selected revision for explicit retry'),
    dom: [
      at(selection, 'adopts the refreshed baseline without a manual refresh after a conflict'),
    ],
    proves: [
      'the conflict notice names the change',
      'the selected revision is preserved for an explicit retry',
      'the refreshed baseline is the newer revision, still the current draft, and adopts it without a manual refresh',
      'the conflict is answered by refreshing, never by repeating the refused write',
    ],
    remainsBrowser: [
      'opening the compare list marks the chosen option aria-selected, and Escape returns focus to the trigger (native focus delivery)',
    ],
  },
  {
    playwright: at(requirements, 'history explains unpublished revision requirements in en'),
    dom: [
      at(selection, 'lists why the chosen revision cannot be published in en'),
    ],
    proves: [
      'the created revision lists the missing title and slug',
      'publish is disabled while restore stays enabled',
      'selecting the head revision removes the reasons, which no longer allow a restore either',
    ],
    remainsBrowser: ['the requirements stay inside the viewport at 1440px (horizontalBounds)'],
  },
  {
    playwright: at(requirements, 'history explains unpublished revision requirements in zh'),
    dom: [
      at(selection, 'lists why the chosen revision cannot be published in zh-CN'),
    ],
    proves: [
      'the Chinese requirements and controls render from the Chinese resources',
      'selecting the head revision removes the reasons',
    ],
    remainsBrowser: [
      'the Chinese requirements stay inside the viewport at 390px, where the selection Select replaces the sidebar (horizontalBounds)',
    ],
  },
]

const compareRetirements: readonly DomRetirement[] = widths.flatMap(width => locales.map((locale): DomRetirement => {
  // The Playwright case names the locale `zh`; the page renders `zh-CN`.
  const rendered = locale === 'en' ? 'en' : 'zh-CN'
  return {
    playwright: at(compare, `history compares revisions with readable labels at ${width}px in ${locale}`),
    dom: [
      at(selection, `reads a chosen revision, rewrites the comparison and writes nothing in ${rendered}`),
      at(selection, `selects a revision with the narrow select exactly as the sidebar does in ${rendered}`),
      at(selection, `selects a baseline with the keyboard and compares against the stored revision in ${rendered}`),
      at(selection, `classifies a block that changed between the two compared revisions in ${rendered}`),
      at(selection, `renders revision labels rather than stored identifiers in ${rendered}`),
      at(panel, `lists saved revisions with restore and preview in the editor panel in ${rendered}`),
    ],
    proves: [
      'choosing a revision reads that revision and leaves the selection on it',
      'the page renders labels (\'Revision 2\') rather than revision, block or document identifiers',
      'the comparison shows the before and after text of a changed block',
      'the sidebar button selects a revision by click, and the narrow selection control selects the same revision by keydown state',
      'the baseline control compares against a chosen stored revision',
      'the preview entry points at the selected revision and opens it in a new tab',
      'no publication write is attempted from any of these reads',
      'the compact editor panel lists the same three revisions, refuses a restore of the head and previews a stored one',
    ],
    remainsBrowser: [
      'opening the selection listbox and choosing an option selects that revision',
      'the open selection listbox stays inside the viewport at 320/390px (horizontalBounds on the listbox)',
      'the selected revision panel stays inside the viewport (horizontalBounds on .history-selection)',
      'the expanded changed block row stays inside the viewport (horizontalBounds on the diff row)',
      'the compact preview/restore actions keep 44px targets and horizontal bounds at 320/390px (geometry)',
      'the compact preview and restore icons render visibly (painted SVG; jsdom proves only that the icon element is present)',
    ],
  }
}))

const editorRetirements: readonly DomRetirement[] = [
  {
    playwright: at(editorConflict, 'a pending conflict refresh explains preserved document edits and merges into one actionable notice'),
    dom: [
      at(conflictRemaining, 'a pending conflict refresh explains preserved document edits and merges into one actionable notice'),
    ],
    proves: [
      'the pending notice is rendered while the newer draft is read, names no catalog concept, and exactly one conflict-tone notice is shown',
      'the merged notice appears when the newer draft lands, the pending notice is gone, no alert remains, and exactly one conflict notice stays',
      'no publication write is sent and every request is served',
    ],
    remainsBrowser: [
      'the pending notice is visible and stays inside 320px (painted visibility and horizontalBounds)',
      'the editor body still holds this window\'s paragraph (the live BlockNote body)',
    ],
  },
  ...widths.flatMap(width => locales.map((locale): DomRetirement => {
    const rendered = locale === 'en' ? 'en' : 'zh-CN'
    return {
      playwright: at(editorConflict, `conflict choices and refreshed comparison remain accessible at ${width}px in ${locale}`),
      dom: [
        at(conflictRemaining, `conflict choices describe both drafts and the refreshed comparison in ${rendered}`),
        at(conflictRemaining, 'the conflict actions write only the refused save and an unavailable recovery copy never reopens'),
      ],
      proves: [
        'the notice is one conflict-tone region with no competing error and no alert',
        'the compare control is a ghost disclosure; both choices are outlined and described by their own help text',
        'comparing opens the comparison, the changed paragraph appears once with the server draft before and the local draft after, and the disclosure collapses and reopens it',
        'editing marks the comparison stale and comparing again replaces it',
        'only the refused revision save is attempted through comparing and the stale recompute',
        'keeping the local edits opens the replacement dialog, and cancelling leaves the draft untouched',
        'asking for the server version with no IndexedDB keeps the draft, reports the unavailable recovery copy and does not reopen',
        'the actions write nothing the refused save had not already written, and no publication write is sent',
      ],
      remainsBrowser: [
        'the notice and its actions are painted and stay inside the viewport, with 44px targets at 320/390px',
        'the live editor body keeps this window\'s paragraph and the edited paragraph the comparison would mark stale',
        'cancelling the replacement dialog returns native focus to the keep control',
        'the live editor element survives opening and cancelling the confirmation (editor identity)',
        'opening the server version reopens the live editor with the server paragraph and removes the notice',
      ],
    }
  })),
  ...conflictAccessible.map((scenario): DomRetirement => ({
    playwright: at(editorConflict, `conflict states are accessible at ${scenario.width}px in ${scenario.locale}`),
    dom: [],
    proves: [],
    remainsBrowser: [
      'an axe scan of the collapsed notice, the expanded comparison and the confirmation dialog runs against real computed styles and accessibility-tree geometry',
    ],
  })),
  ...widths.flatMap(width => locales.map((locale): DomRetirement => {
    const rendered = locale === 'en' ? 'en' : 'zh-CN'
    return {
      playwright: at(preview, `both preview entries show the unsaved draft without remounting at ${width}px in ${locale}`),
      dom: [
        at(previewEntries, `offers exactly one draft preview entry in the content tab in ${rendered}`),
        at(previewEntries, `opens one draft preview from the content tab and the action menu in ${rendered}`),
        at(previewEntries, `opens one draft preview from the compact action drawer in ${rendered}`),
        at(previewEntries, `closes the draft preview and reopens it with the current draft in ${rendered}`),
      ],
      proves: [
        'the real Content tab renders exactly one draft-preview entry and no saved-revision preview link',
        'the Content tab entry and the desktop action menu open the same single preview dialog',
        'the compact action drawer opens the same single preview dialog and closes behind it',
        'the reader region renders the current unsaved draft and not the saved revision',
        'a complete draft shows no preview error',
        'closing the preview removes the only dialog, and reopening it reads the current draft again',
        'previewing from any entry issues no request, so it publishes nothing',
      ],
      remainsBrowser: [
        'the real settings drawer and Content tab around that section, and the Radix menu and compact drawer: the dialog and close-button horizontal bounds, the viewport fit and the drawer at 320/390px are measured there',
        'the preview reader shows the paragraph typed into the live BlockNote editor, which is the snapshot source the jsdom case supplies',
        'closing the preview returns native focus to the entry that opened it, and Escape closes it from the menu',
        'neither entry recreates the editor element that holds the unsaved paragraph (element identity), and the held save then completes',
      ],
    }
  })),
  ...narrow.flatMap(width => locales.map((locale): DomRetirement => {
    const rendered = locale === 'en' ? 'en' : 'zh-CN'
    return {
      playwright: at(preview, `local recovery is readable, dismissible and recoverable at ${width}px in ${locale}`),
      dom: [
        at(previewRecovery, `offers the stored local copy with its saved time and both actions in ${rendered}`),
        at(previewRecovery, `reopens the stored local copy from the notice in ${rendered}`),
      ],
      proves: [
        'the notice names the stored local copy and shows its own description',
        'its time element carries the stored instant and a visible year under the Saved label',
        'the tone icon and both action icons are present and decorative',
        'both actions are named Open recovered draft and Dismiss',
        'dismissing the notice removes it, and reopening it hands the stored document and its base revision to the session',
        'reading or dismissing the notice issues no request',
      ],
      remainsBrowser: [
        'the copy is written and read back through the real IndexedDB schema across a reload',
        'after dismissing and reloading, the notice is offered again: the stored copy survives the reload',
        'the notice and its actions stay inside the compact viewport with 44px targets, and the tone and action icons are painted',
        'dismissing keeps the server paragraph, and opening the copy applies it to the live editor',
      ],
    }
  })),
  ...scanned.map((width): DomRetirement => ({
    playwright: at(a11y, `draft preview and local recovery are accessible at ${width}px`),
    dom: [],
    proves: [],
    remainsBrowser: [
      'an axe scan of the preview dialog and the recovery notice runs against real computed styles and the accessibility tree',
    ],
  })),
  ...scanned.map((width): DomRetirement => ({
    playwright: at(a11y, `history comparison and confirmation are accessible at ${width}px`),
    dom: [],
    proves: [],
    remainsBrowser: [
      'an axe scan of the comparison and the confirmation dialog runs against real computed styles and the accessibility tree',
    ],
  })),
]

// Two history cases stay in the real browser for facts no component or DOM mount can
// hold: persisted server state behind the rendered reader, and native history traversal.
const browserRetirements: readonly DomRetirement[] = [
  {
    playwright: at(e2ePage, 'history compares stable blocks, restores a new head and publishes a selected historical revision'),
    dom: [],
    proves: [],
    remainsBrowser: [
      'the stored head, live revision and version after a restore and a publish are read back from real D1',
      'the published reader routes are served by the real Worker (/posts/<slug> gone, /posts/<slug>-updated readable)',
    ],
  },
  {
    playwright: e2eInterleaving,
    dom: [],
    proves: [],
    remainsBrowser: [
      'native browser history traversal, repairs and the editor before-leave guard only exist in a live page with the editor',
    ],
  },
]

export const domRetirements: readonly DomRetirement[] = [
  ...pageRetirements,
  ...compareRetirements,
  ...editorRetirements,
  ...browserRetirements,
]

/** Execution boundaries for interpreting the history DOM retirement mapping. */
export const domGatePrerequisites: readonly string[] = [
  'Use the official `test:dom` config; its host aliases do not prove Next routing or native history traversal.',
  'Radix API stubs in `history-state-support.tsx` enable state tests, not layout, native keyboard or focus delivery claims.',
  'Exact retirement keys belong to the checked `dom-migrations` ledger; this mapping alone is not execution evidence.',
]
