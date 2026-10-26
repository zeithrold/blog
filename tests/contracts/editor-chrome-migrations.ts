/* eslint-disable style/max-len -- Verbatim case references stay on one line. */
import type { CaseMigration } from './types'

/**
 * Where the retired editor chrome browser cases now run.
 *
 * `legacy` names the E2E case that owned the assertion, `component` names the
 * component browser case that proves it on the production editor entry (real
 * `SiteShell` appbar, real header, drawers and dialogs, real BlockNote body), and
 * `proves` lists the original assertions that case covers. Draft saves and the
 * publication write are acknowledged by the case; stored revisions, head/live
 * isolation and the public page stay with the E2E cases below.
 *
 * The split follows the material claim, not the file: header geometry, the sticky
 * toolbar offset, the compact inspector overlay, the dynamic-import loader and
 * the localized action drawer are client facts and moved whole. The stored draft
 * and publication journeys stay E2E because only the Worker with its own D1 can
 * answer them.
 *
 * Affected evidence wiring outside this table: `tests/contracts/surface-migrations.ts`
 * composes these records (`...editorChromeMigrations`), and the `editor-actions`
 * row of `tests/support/browser/editor-control-inventory.ts` gains the component
 * specs here as evidence. `editor-layout.spec.ts` and `editor-loading-drawer.spec.ts`
 * are retired whole, so no inventory row names them.
 */

const F = {
  layout: 'tests/browser/editor/editor-layout.spec.ts',
  loading: 'tests/browser/editor/editor-loading-drawer.spec.ts',
  mobile: 'tests/browser/editor/mobile-editor-actions.spec.ts',
  chromeLayout: 'tests/components/specs/editor-chrome-layout.spec.ts',
  chromeLoading: 'tests/components/specs/editor-chrome-loading.spec.ts',
  chromeActions: 'tests/components/specs/editor-chrome-mobile-actions.spec.ts',
} as const

function c(file: string, title: string): string {
  return `${file} :: ${title}`
}

const scheduleSurvives = 'schedule input and verified times survive closing the compact inspector and resizing'
const stickyToolbar = 'wrapped status keeps the sticky toolbar below the measured header at 320px'
const loaderSkeleton = 'the editor loader displays a skeleton and spinner and respects reduced motion'
const compactInspector = 'the compact inspector opens from the bottom and keeps its footer reachable while scrolling'
const mobilePreview = 'mobile preview closes the action drawer and resizing never reopens a dismissed panel'
const syncConflict = 'mobile sync remains disabled when a draft requires conflict resolution'
const syncStored = 'mobile sync writes pending changes privately and autosave remains independent'
const publishStored = 'mobile publish drains pending edits and exposes the live document and unpublish through the drawer'

const headerRowProves = [
  'the compact back link reads Back / 返回 while the full label stays All documents / 所有文档',
  'the back link, Publish and the actions trigger share one centre line within 2px',
  'both action targets are at least 44px tall and the header stays at most 110px tall',
  'the wrapped status row starts below the publish action and the page does not overflow horizontally',
  'the actions trigger opens the drawer with its handle and the translated autosave description',
  'Sync draft now is disabled for the clean draft and no desktop menu is mounted',
  'Close, Escape and cancelling the delete confirmation all return focus to the trigger',
  'the body keeps its text after the dialogs, in both locales',
]

export const editorChromeMigrations: readonly CaseMigration[] = [
  {
    id: 'editor.schedule-inspector-survival',
    legacy: [
      c(F.layout, scheduleSurvives),
    ],
    component: [
      {
        case: c(F.chromeLayout, scheduleSurvives),
        proves: [
          'the real entry loads its session and document over HTTP and the compact inspector opens on the Publication tab',
          'a typed local time, the Asia/Tokyo plan and the verified +540 UTC choice stay in the form after closing the drawer',
          'reopening keeps the Publication tab, May 1 2099, 10:30 and the same verified offset',
          'resizing to the inline 1440px panel keeps the tab, timezone and offset, and the 320px drawer still shows it',
          'closing the drawer returns focus to the Document settings trigger',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'editor.sticky-toolbar-offset',
    legacy: [
      c(F.layout, stickyToolbar),
    ],
    component: [
      {
        case: c(F.chromeLayout, stickyToolbar),
        proves: [
          'the acknowledged publish reaches the Published status and the next acknowledged save reports unpublished changes',
          'at 320px the toolbar never rises above the measured header bottom and the header sits on the shell appbar',
          'the wrapped status row does not make the page overflow horizontally',
          'the header measures taller at 320px than at 1440px',
          'the run records no page error or console error',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'editor.loader-skeleton',
    legacy: [
      c(F.loading, loaderSkeleton),
    ],
    component: [
      {
        case: c(F.chromeLoading, loaderSkeleton),
        proves: [
          'holding the production editor chunk shows the real Suspense fallback: visible skeleton blocks and a Loading editor… status',
          'the spinner plays the spin animation',
          'reduced motion removes the animation from the spinner and the skeleton',
          'releasing the chunk renders the loaded body and unmounts the loader',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'editor.compact-inspector-overlay',
    legacy: [
      c(F.loading, compactInspector),
    ],
    component: [
      {
        case: c(F.chromeLayout, compactInspector),
        proves: [
          'the drawer keeps its drawer class, its handle and a bottom edge within 2px of the viewport',
          'the drawer is at most 90% of the viewport height',
          'the reference page opens inside the drawer and its Add reference dialog closes again',
          'the settings region scrolls while the Close control stays in view and returns focus to the trigger',
          'the same editor node stays connected through closing, reopening and the switch to the inline panel',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'editor.mobile-header-actions',
    legacy: [320, 390].flatMap(width => (['en', 'zh'] as const).map(locale =>
      c(F.mobile, `mobile actions fit two header rows at ${width}px in ${locale} and return focus after dialogs`))),
    component: [320, 390].flatMap(width => (['en', 'zh'] as const).map(locale => ({
      case: c(F.chromeActions, `mobile actions fit two header rows at ${width}px in ${locale} and return focus after dialogs`),
      proves: headerRowProves,
    }))),
    retained: [],
  },
  {
    id: 'editor.mobile-action-drawer',
    legacy: [
      c(F.mobile, mobilePreview),
    ],
    component: [
      {
        case: c(F.chromeActions, mobilePreview),
        proves: [
          'Preview closes the drawer and opens the draft preview with the document title and body',
          'Close preview returns focus to the actions trigger',
          'widening to 1440px closes the panel without opening a menu, and returning to 390px keeps it closed until the trigger is used again',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'editor.mobile-sync-conflict',
    legacy: [
      c(F.mobile, syncConflict),
    ],
    component: [
      {
        case: c(F.chromeActions, syncConflict),
        proves: [
          'a refused revision write reports Conflict — draft preserved',
          'the drawer offers Sync draft now disabled in that state',
          'closing the drawer keeps the local conflicting draft in the editor',
          'the only write attempted is the refused revision route, so nothing was stored',
        ],
      },
    ],
    retained: [
      {
        cases: [
          c(F.mobile, syncConflict),
        ],
        reason: 'The stored half is a Worker fact: the case reads the document back and proves headRevisionId did not advance. The component boundary can prove no write was attempted, not what the database holds.',
      },
    ],
  },
  {
    id: 'editor.mobile-draft-persistence',
    legacy: [
      c(F.mobile, syncStored),
      c(F.mobile, publishStored),
    ],
    component: [],
    retained: [
      {
        cases: [
          c(F.mobile, syncStored),
        ],
        reason: 'Private draft persistence is stored state: the synchronized revision becomes head while the live revision stays null, the public path answers 404, and a later automatic save advances head on its own. Only the Worker with its own D1 can answer that.',
      },
      {
        cases: [
          c(F.mobile, publishStored),
        ],
        reason: 'Publishing drains pending edits in order and then exposes the live revision, its live path and the public page body. The request order and the served page are Worker facts; the drawer chrome those steps pass through is covered by the component action cases.',
      },
    ],
  },
]
