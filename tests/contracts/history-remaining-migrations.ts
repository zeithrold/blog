/* eslint-disable style/max-len -- Verbatim case references stay on one line. */
/**
 * Where the remaining history browser assertions now live.
 *
 * `legacy` names one E2E case by `file :: title`, `component` names the component
 * browser case that replaced it and the original assertions it proves, and
 * `retained` names cases that stay in the real E2E suite with the reason only the
 * built application can prove them. The component cases mount the production
 * editor entry and the unmodified history page: the real BlockNote editor, draft
 * controller, coordinator, client, translations and production CSS, with every
 * HTTP reply coming from the case's own handler table.
 *
 * An entry with `legacy: []` and `component: []` registers cases that stay without
 * replacing anything. Each reason names the native fact for that one case, and says
 * explicitly when the case is only temporarily browser-level because a faster layer
 * is expected to take it over.
 */
import type { CaseMigration } from './types'

const notice = 'tests/browser/history/conflict-notice-polish.spec.ts'
const conflict = 'tests/browser/history/conflict.spec.ts'
const polish = 'tests/browser/history/preview-history-polish.spec.ts'
const a11y = 'tests/browser/history/preview-history-a11y.spec.ts'
const boundaries = 'tests/browser/history/editor-history-boundaries.spec.ts'
const focus = 'tests/browser/history/editor-history-focus.spec.ts'
const upload = 'tests/browser/history/editor-history-upload.spec.ts'
const noticeSpec = 'tests/components/specs/editor-history-remaining-conflict.spec.ts'
const previewSpec = 'tests/components/specs/editor-history-remaining-preview.spec.ts'
const compareSpec = 'tests/components/specs/editor-history-remaining-compare.spec.ts'
const a11ySpec = 'tests/components/specs/editor-history-remaining-a11y.spec.ts'
const saveConflict = 'tests/integration/history-save-conflict.integration.ts'

function c(file: string, title: string): string {
  return `${file} :: ${title}`
}

const widths = [
  320,
  390,
  1440,
] as const
const locales = ['en', 'zh'] as const
const compactWidths = [320, 390] as const
const scanners: readonly { width: number, locale: 'en' | 'zh' }[] = [
  { width: 320, locale: 'zh' },
  { width: 1440, locale: 'en' },
]
const previewScanners = [390, 1440] as const

const previewAxe = 'the Content tab draft preview passes Axe'
const recoveryAxe = 'the recovery notice passes Axe'
const historyAxe = 'the comparison passes Axe with the changed paragraph open'
const confirmationAxe = 'the restore confirmation dialog passes Axe'

export const historyRemainingMigrations: readonly CaseMigration[] = [
  {
    id: 'history.conflict-notice',
    legacy: [
      c(notice, 'a pending conflict refresh explains preserved document edits and merges into one actionable notice'),
      ...widths.flatMap(width => locales.map(locale =>
        c(notice, `conflict choices and refreshed comparison remain accessible at ${width}px in ${locale}`))),
      ...scanners.map(scenario =>
        c(notice, `conflict states are accessible at ${scenario.width}px in ${scenario.locale}`)),
    ],
    component: [
      {
        case: c(noticeSpec, 'a pending conflict refresh explains preserved document edits and merges into one actionable notice'),
        proves: [
          'the pending notice is visible and stays inside 320px',
          'the editor body still holds this window\'s paragraph',
          'the pending notice copy, its merge into one notice, the no-catalog claim and the single conflict tone moved to tests/dom/history-conflict-remaining.test.tsx :: a pending conflict refresh explains preserved document edits and merges into one actionable notice',
        ],
      },
      ...widths.flatMap(width => locales.map((locale) => {
        const rendered = locale === 'en' ? 'en' : 'zh-CN'
        return {
          case: c(noticeSpec, `conflict choices and refreshed comparison remain accessible at ${width}px in ${locale}`),
          proves: [
            'the notice and its actions are painted and stay inside the viewport, with 44px targets at 320/390px',
            'the live editor keeps this window\'s paragraph and, on a successful open, reopens the server paragraph',
            'cancelling the replacement dialog returns focus to the keep control',
            `the notice copy, the choice variants and descriptions, the comparison disclosure and before/after text, and the request log before the choices are taken moved to tests/dom/history-conflict-remaining.test.tsx :: conflict choices describe both drafts and the refreshed comparison in ${rendered}`,
            'the Keep/Cancel dialog and the no-IndexedDB open behavior moved to tests/dom/history-conflict-remaining.test.tsx :: the conflict actions write only the refused save and an unavailable recovery copy never reopens',
          ],
        }
      })),
      ...scanners.map(scenario => ({
        case: c(noticeSpec, `conflict states are accessible at ${scenario.width}px in ${scenario.locale}`),
        describe: ['accessibility scanner'],
        proves: [
          `the collapsed conflict notice passes Axe at ${scenario.width}px in ${scenario.locale}`,
          `the expanded comparison passes Axe at ${scenario.width}px in ${scenario.locale}`,
          `the replacement confirmation passes Axe at ${scenario.width}px in ${scenario.locale}`,
        ],
      })),
    ],
    retained: [
      {
        cases: [
          c(conflict, 'two tabs preserve conflicting content and require a focused explicit replacement dialog'),
        ],
        reason: 'Two real tabs against the real Worker: the server refuses the second tab save, the confirmation returns focus without recreating the live editor, and the preserved content survives a full reload. D1 persistence and a real page reload are what the component harness cannot provide; this migration\'s component cases cover the comparison, the dialog and focus return.',
      },
    ],
  },
  {
    id: 'history.preview-entries',
    legacy: widths.flatMap(width => locales.map(locale =>
      c(polish, `both preview entries show the unsaved draft without remounting at ${width}px in ${locale}`))),
    component: widths.flatMap(width => locales.map((locale) => {
      const rendered = locale === 'en' ? 'en' : 'zh-CN'
      return {
        case: c(previewSpec, `both preview entries show the unsaved draft without remounting at ${width}px in ${locale}`),
        proves: [
          'the real settings drawer and Content tab around that section, and the Radix menu and compact drawer: the dialog and close-button horizontal bounds, the viewport fit and the drawer at 320/390px',
          'the preview reader shows the paragraph typed into the live BlockNote editor',
          'closing the preview returns native focus to the entry that opened it, and Escape closes it from the menu',
          'neither entry recreates the editor element that holds the unsaved paragraph',
          `the one-entry Content tab, the desktop menu and compact drawer previews, the current draft, the absent error, the close/reopen and the zero-request proof moved to tests/dom/history-preview-remaining-entries.test.tsx in ${rendered}`,
        ],
      }
    })),
    retained: [
      {
        cases: [
          c(polish, 'the historical preview entry opens the stored revision in a new tab'),
        ],
        reason: 'The entry is a link to /admin/preview/<document>/<revision>: opening it serves the stored revision from D1 through the real route in a new tab. The component case proves the entry and the comparison; only the built application serves that reader page.',
      },
    ],
  },
  {
    id: 'history.local-recovery',
    legacy: compactWidths.flatMap(width => locales.map(locale =>
      c(polish, `local recovery is readable, dismissible and recoverable at ${width}px in ${locale}`))),
    component: compactWidths.flatMap(width => locales.map((locale) => {
      const rendered = locale === 'en' ? 'en' : 'zh-CN'
      return {
        case: c(previewSpec, `local recovery is readable, dismissible and recoverable at ${width}px in ${locale}`),
        proves: [
          'the copy is written and read back through the real IndexedDB schema across a reload',
          'after dismissing and reloading, the notice is offered again: the stored copy survives the reload',
          'the notice and its actions stay inside the compact viewport with 44px targets, and the icons are painted',
          'dismissing keeps the server paragraph, and opening the copy applies it to the live editor',
          `the notice copy, the saved time, the action names, the dismissal and the zero-request proof moved to tests/dom/history-preview-remaining-recovery.test.tsx in ${rendered}`,
        ],
      }
    })),
    retained: [],
  },
  {
    id: 'history.compare-labels',
    legacy: widths.flatMap(width => locales.map(locale =>
      c(polish, `history compares revisions with readable labels at ${width}px in ${locale}`))),
    component: widths.flatMap(width => locales.map((locale) => {
      const rendered = locale === 'en' ? 'en' : 'zh-CN'
      return {
        case: c(compareSpec, `history compares revisions with readable labels at ${width}px in ${locale}`),
        proves: [
          'the open selection listbox stays inside the viewport at 320/390px',
          'the selected revision panel stays inside the viewport',
          'the expanded changed block row stays inside the viewport',
          'the compact preview and restore actions keep 44px targets and horizontal bounds at 320/390px',
          'the compact preview and restore icons render visibly',
          `the readable labels, the head restore refusal, the comparison text, the identifier-free output and the preview href moved to tests/dom/history-state-selection.test.tsx and tests/dom/history-state-editor-history.test.tsx in ${rendered}`,
        ],
      }
    })),
    retained: [],
  },
  {
    id: 'history.preview-recovery-a11y',
    legacy: previewScanners.map(width =>
      c(a11y, `draft preview, recovery, history and confirmation are accessible at ${width}px`)),
    component: [
      ...previewScanners.flatMap(width => ([
        {
          case: c(a11ySpec, `draft preview and local recovery are accessible at ${width}px`),
          describe: ['accessibility scanner'],
          proves: [
            `${previewAxe} at ${width}px`,
            `${recoveryAxe} at ${width}px`,
          ],
        },
        {
          case: c(a11ySpec, `history comparison and confirmation are accessible at ${width}px`),
          describe: ['accessibility scanner'],
          proves: [
            `${historyAxe} at ${width}px`,
            `${confirmationAxe} at ${width}px`,
          ],
        },
      ])),
    ],
    retained: [],
  },
  {
    id: 'history.native-traversal',
    legacy: [],
    component: [],
    retained: [
      {
        cases: [
          c(boundaries, 'cancel and Escape keep the editor at its history entry despite a late save'),
        ],
        reason: 'A held save intercepts native Back, and both Stay here and Escape keep the editor on the entry it is already on: the case asserts the URL, the unchanged `history.length` and the stored "Kept after cancelling history" title once the late save completes. The entry count and the late store need a real page behind the editor and D1; the dialog copy and Escape handling alone belong to a component case.',
      },
      {
        cases: [
          c(boundaries, 'a failed browser traversal can retry saving without adding history'),
        ],
        reason: 'The revision write answers 503, so the guard shows its own recovery copy instead of the raw code, and "Retry save" (Chinese, 320px) leaves to Documents with "History failure edit" stored and `history.length` unchanged. Real entry count, localized shell and D1 remain browser facts; the dialog, alert and Axe assertions can move to a component case.',
      },
      {
        cases: [
          c(boundaries, 'a failed browser traversal can explicitly leave without adding history'),
        ],
        reason: 'The same refused save, but "Leave without saving" must leave the stored title untouched while still adding no history entry: the case asserts the server document keeps its original title and `history.length` is unchanged. Only the stored document and the real entry count prove that.',
      },
      {
        cases: [
          c(boundaries, 'a newer opposite traversal replaces the destination during a save'),
        ],
        reason: 'Back opens the guard with the save held, then Forward replaces the destination: exactly one revision request is made, the editor ends on the Tags route and `history.length` is unchanged. The queued native Back/Forward pair and the real Tags entry are what the harness cannot provide.',
      },
      {
        cases: [
          c(boundaries, 'rapid repeated Back requests can be cancelled without a late history jump'),
        ],
        reason: 'Two Back requests issued in one task are answered by a single guard: Stay here cancels both, the URL stays on the editor, `history.length` is unchanged and the held save then completes. Queued pops and their cancellation are browser behaviour.',
      },
      {
        cases: [
          c(boundaries, 'leaving across a native hash entry saves first and restores the full traversal distance'),
        ],
        reason: 'A native `location.hash` entry adds exactly one entry, `history.go(-2)` saves first and lands on Documents, the router index (`__blogHistory`) returns to the entry before the hash, and `history.go(2)` reopens the editor with "History after native hash". The entry set and the router index marker exist only in the built application.',
      },
      {
        cases: [
          c(boundaries, 'same-document query history receives the save guard and does not add a route entry'),
        ],
        reason: '`history.pushState(?view=other)` makes a same-document entry; Back over it is intercepted by the save guard, the save completes, the URL returns to the editor path with the edit intact and `history.length` is one entry longer. Same-document entries and guarding their popstate are browser facts.',
      },
      {
        cases: [
          c(boundaries, 'a history branch and multi-step traversal use actual positions despite router index gaps'),
        ],
        reason: 'Real Tags and Series navigations create a branch; `history.go(-2)` back into the editor is guarded, the router index reports the actual position (source + 2) rather than the gap between router entries, and after the save it returns to the source with `history.length` unchanged. Needs real route entries and the router index marker.',
      },
    ],
  },
  {
    id: 'history.departure-focus',
    legacy: [],
    component: [],
    retained: [
      {
        cases: [
          c(focus, 'mobile cancellation returns to the edited title'),
        ],
        reason: 'The departure is a native Back requested while the edited title owns focus, so the guard restores focus to that textbox and the held save then completes. No harness page has a real entry behind it and no bridge intercepts Back, so the trigger is browser-level today; the focus decision itself is a function of the prior element and is expected to move to the fast hook layer — update this key when it does. The guard request/refusal/approval state is now proved in jsdom (tests/dom/history-guard-state.test.tsx); see history-guard-retirements.ts. The focus return and native Back stay here until the semantic is narrowed.',
      },
      {
        cases: [
          c(focus, 'mobile cancellation returns to the menu trigger'),
        ],
        reason: 'The departure is an internal Tags navigation from the mobile menu, so the guard rejects the menu item as a restore target and focuses the menu trigger. This asserts the focus-restoration branch rather than a traversal, so it is retained only until the component or fast hook layer covers guarded internal navigation; it is not a permanent E2E requirement — update this key when it moves. The guard registration/cancel and the departure policy are now proved in jsdom (tests/dom/history-guard-state.test.tsx, tests/dom/history-departure-policy.test.tsx); see history-guard-retirements.ts. Native focus and the route stay here until the semantic is narrowed.',
      },
    ],
  },
  {
    id: 'history.upload-departure',
    legacy: [],
    component: [],
    retained: [
      {
        cases: [
          c(upload, 'immediate paste upload handles history departure'),
        ],
        reason: 'A pasted image starts a real `PUT /api/admin/assets/*/content` upload that is still held when Back is requested; `beforeunload` is prevented immediately, departure leaves to Documents, and the stored document carries the image block with its asset URL and media accessibility entry while `history.length` is unchanged. Real paste, upload wire and D1.',
      },
      {
        cases: [
          c(upload, 'immediate paste upload handles history cancellation'),
        ],
        reason: 'The same paste and held upload, but Stay here keeps the editor: the image re-renders, the save completes, the URL and `history.length` stay put and the stored document still carries the image. Releasing the upload after staying is what makes it browser-level.',
      },
      {
        cases: [
          c(upload, 'a queued file blocks browser traversal and remains available after staying'),
        ],
        reason: 'A file chosen in the media dialog but not yet uploaded blocks the traversal: the guard reports "Finish or remove the queued uploads before leaving", Stay here keeps the editor, re-opening the media dialog still lists the file and `history.length` is unchanged. The queue gate itself is controller logic for the fast layer; the native Back and the entry count keep this case E2E today.',
      },
    ],
  },
]

/**
 * Server guarantees behind the component conflict cases.
 *
 * A fixture can return 409 for any reason, so the refusal code and the persisted
 * race result are proved once against the Worker and real D1 instead of being
 * inferred from the notice the component renders.
 */
export type HistoryRemainingServerProof = {
  readonly component: string
  readonly integration: readonly string[]
  readonly proves: readonly string[]
}

export const historyRemainingServerProofs: readonly HistoryRemainingServerProof[] = [
  {
    component: c(noticeSpec, 'conflict choices and refreshed comparison remain accessible at 320px in en'),
    integration: [
      c(saveConflict, 'a save carrying a stale version is refused and leaves the racing save as head'),
    ],
    proves: [
      'saving with the version the editor held before another tab saved is 409 EDIT_CONFLICT',
      'the persisted head, version and document stay as the racing save left them, with no extra revision',
    ],
  },
]
