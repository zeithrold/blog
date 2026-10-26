/* eslint-disable style/max-len -- Exact case keys and retention reasons stay on one line. */
import type { DomMigrationRecord } from './dom-migrations'

const layout = 'tests/components/specs/editor-chrome-layout.spec.ts'
const loading = 'tests/components/specs/editor-chrome-loading.spec.ts'
const actions = 'tests/components/specs/editor-chrome-mobile-actions.spec.ts'
const layoutDom = 'tests/dom/editor-chrome-layout.test.tsx'
const loadingDom = 'tests/dom/editor-chrome-loading.test.tsx'
const actionsDom = 'tests/dom/editor-chrome-mobile-actions.test.tsx'
const widths = [320, 390] as const
const locales = ['en', 'zh'] as const

function at(file: string, title: string): string {
  return `${file} :: ${title}`
}

/** Editor chrome moves only DOM/controller assertions; native residuals remain explicit. */
export const editorChromeDomMigrations: readonly DomMigrationRecord[] = [
  {
    id: 'editor-chrome.layout',
    legacy: [
      at(layout, 'compact settings drawer returns focus after close and reopen'),
      at(layout, 'wrapped status keeps the sticky toolbar below the measured header at 320px'),
      at(layout, 'the compact inspector opens from the bottom and keeps its footer reachable while scrolling'),
    ],
    dom: [
      {
        case: at(layoutDom, 'the schedule form retains its values through the compact settings lifecycle'),
        proves: [
          'the compact settings drawer selects a date, time, timezone and verified UTC choice in the real ScheduleSettings',
          'closing and reopening the drawer preserves every selected schedule value',
          'the real settings subtree keeps every selected value through the 320→1440→320 responsive rebuild',
        ],
      },
      {
        case: at(layoutDom, 'the schedule calendar applies its selected date and default time to the real form'),
        proves: [
          'the real date picker writes its selected 2099-05-01 date and default 09:00 time into ScheduleSettings',
        ],
      },
      {
        case: at(layoutDom, 'the real header describes a published revision with a dirty draft'),
        proves: [
          'editing metadata changes the live header to Published · unpublished changes',
          'the SaveStatus component reports a dirty draft',
        ],
      },
      {
        case: at(layoutDom, 'the settings panel opens and cancels a reference editor without losing its content tab'),
        proves: [
          'the real References settings panel opens Add reference and renders the reference dialog',
          'Cancel closes the dialog and leaves the Content tab selected',
        ],
      },
    ],
    retained: [
      {
        cases: [
          at(layout, 'compact settings drawer returns focus after close and reopen'),
        ],
        reason: 'Native focus return to Document settings after closing the real drawer remains browser-only across close/reopen and responsive layout changes.',
      },
      {
        cases: [
          at(layout, 'wrapped status keeps the sticky toolbar below the measured header at 320px'),
        ],
        reason: 'Sticky header/toolbar gaps and narrow-page overflow are measured from real geometry while scrolling and resizing.',
      },
      {
        cases: [
          at(layout, 'the compact inspector opens from the bottom and keeps its footer reachable while scrolling'),
        ],
        reason: 'The drawer bottom/height, real scroll region, in-viewport footer and native focus return require a browser layout/focus engine.',
      },
    ],
  },
  {
    id: 'editor-chrome.loading',
    legacy: [
      at(loading, 'the editor loader displays a skeleton and spinner and respects reduced motion'),
    ],
    dom: [
      {
        case: at(loadingDom, 'the real editor fallback renders its loading status, spinner and skeleton structure'),
        proves: [
          'the real fallback renders the Loading editor status, spinner element and multiple skeleton blocks',
          'the copy and settings skeleton regions are hidden from the accessibility tree',
        ],
      },
    ],
    retained: [
      {
        cases: [
          at(loading, 'the editor loader displays a skeleton and spinner and respects reduced motion'),
        ],
        reason: 'The held production editor chunk, computed animation names under reduced motion and the loaded editor replacing Suspense are browser boundaries.',
      },
    ],
  },
  {
    id: 'editor-chrome.mobile-actions',
    legacy: [
      ...widths.flatMap(width => locales.map(locale =>
        at(actions, `mobile actions fit two header rows at ${width}px in ${locale} and return focus after dialogs`))),
      at(actions, 'mobile preview keeps the live draft and returns focus when closed'),
      at(actions, 'mobile sync remains disabled when a draft requires conflict resolution'),
    ],
    dom: [
      {
        case: at(actionsDom, 'the compact header and saved action menu expose independent en copy'),
        proves: [
          'the real header exposes localized full/compact labels and Publish',
          'the clean draft menu lists Preview, sync and delete with sync disabled',
        ],
      },
      {
        case: at(actionsDom, 'the compact header and saved action menu expose independent zh-CN copy'),
        proves: [
          'the Chinese header exposes localized full/compact labels and 发布',
          'the clean Chinese draft menu lists preview, sync and delete with sync disabled',
        ],
      },
      {
        case: at(actionsDom, 'the mobile action drawer stays dismissed after widening until manually reopened'),
        proves: [
          'the real mobile action drawer closes when the host widens from 390px and does not reopen when it returns to 390px',
          'the More document actions control can manually reopen and close the drawer after the responsive change',
        ],
      },
      {
        case: at(actionsDom, 'a refused revision save makes the real draft and sync action conflict-disabled'),
        proves: [
          'a real dirty-draft sync sends the revision route and the 409 response sets draft conflict state',
          'Publish and Sync draft now are disabled in conflict and the status copy names the conflict',
          'the refused revision save is the only write attempted',
        ],
      },
    ],
    retained: [
      {
        cases: widths.flatMap(width => locales.map(locale =>
          at(actions, `mobile actions fit two header rows at ${width}px in ${locale} and return focus after dialogs`))),
        reason: 'Each browser case measures two header rows, 44px hit targets, drawer geometry and native focus return after Close/Escape/cancel.',
      },
      {
        cases: [
          at(actions, 'mobile preview keeps the live draft and returns focus when closed'),
        ],
        reason: 'The live BlockNote paragraph in the mobile preview and native focus return to More after Close remain browser-only.',
      },
      {
        cases: [
          at(actions, 'mobile sync remains disabled when a draft requires conflict resolution'),
        ],
        reason: 'The browser case keeps the local conflicting paragraph in the live contenteditable after the compact drawer closes.',
      },
    ],
  },
]
