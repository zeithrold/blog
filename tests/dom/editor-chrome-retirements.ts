/* eslint-disable style/max-len -- One row per registered component case with exact lineage and successors. */
/**
 * Where each editor chrome component case now runs.
 *
 * `lineage` lists the earlier E2E case when it exists; the row's `playwright`
 * key is the current component generation, and `dom` names its jsdom successors.
 * Native/editor-specific assertions that stay in the component plan are listed
 * individually in `remainsBrowser`.
 */

export type EditorChromeDomRetirement = {
  readonly playwright: string
  readonly lineage: readonly string[]
  readonly dom: readonly string[]
  readonly proves: readonly string[]
  readonly remainsBrowser: readonly string[]
}

const layout = 'tests/components/specs/editor-chrome-layout.spec.ts'
const loading = 'tests/components/specs/editor-chrome-loading.spec.ts'
const actions = 'tests/components/specs/editor-chrome-mobile-actions.spec.ts'
const e2eLayout = 'tests/browser/editor/editor-layout.spec.ts'
const e2eLoading = 'tests/browser/editor/editor-loading-drawer.spec.ts'
const e2eActions = 'tests/browser/editor/mobile-editor-actions.spec.ts'
const layoutDom = 'tests/dom/editor-chrome-layout.test.tsx'
const loadingDom = 'tests/dom/editor-chrome-loading.test.tsx'
const actionsDom = 'tests/dom/editor-chrome-mobile-actions.test.tsx'
const widths = [320, 390] as const
const locales = ['en', 'zh'] as const

function at(file: string, title: string): string {
  return `${file} :: ${title}`
}

export const editorChromeDomRetirements: readonly EditorChromeDomRetirement[] = [
  {
    playwright: at(layout, 'compact settings drawer returns focus after close and reopen'),
    lineage: [
      at(e2eLayout, 'schedule input and verified times survive closing the compact inspector and resizing'),
    ],
    dom: [
      at(layoutDom, 'the schedule form retains its values through the compact settings lifecycle'),
      at(layoutDom, 'the schedule calendar applies its selected date and default time to the real form'),
    ],
    proves: [
      'the compact settings drawer sets a date, time, timezone and verified UTC value in the real ScheduleSettings',
      'all selected values survive closing/reopening and the 320→1440→320 responsive rebuild',
    ],
    remainsBrowser: [
      'closing the real compact SettingsDrawer delivers native focus back to Document settings before and after a 320↔1440px layout change',
    ],
  },
  {
    playwright: at(layout, 'wrapped status keeps the sticky toolbar below the measured header at 320px'),
    lineage: [
      at(e2eLayout, 'wrapped status keeps the sticky toolbar below the measured header at 320px'),
    ],
    dom: [
      at(layoutDom, 'the real header describes a published revision with a dirty draft'),
    ],
    proves: [
      'editing a real metadata field changes the saved published header to the Published · unpublished changes state',
      'the SaveStatus component reports a dirty draft',
    ],
    remainsBrowser: [
      'the sticky toolbar-to-header and header-to-appbar gaps are measured from real getBoundingClientRect values while scrolling',
      'the 320px header wrapping does not create painted horizontal overflow and its measured height exceeds the 1440px header',
    ],
  },
  {
    playwright: at(layout, 'the compact inspector opens from the bottom and keeps its footer reachable while scrolling'),
    lineage: [
      at(e2eLayout, 'the compact inspector opens from the bottom and keeps its footer reachable while scrolling'),
    ],
    dom: [
      at(layoutDom, 'the settings panel opens and cancels a reference editor without losing its content tab'),
    ],
    proves: [
      'the real References settings panel opens Add reference and renders the reference dialog',
      'Cancel closes the dialog and leaves the Content tab selected',
    ],
    remainsBrowser: [
      'the compact drawer bottom edge and height are measured against the viewport',
      'the nested settings region scrolls while the drawer Close control remains in view',
      'Close returns native focus to Document settings and the same live editor element stays connected through close/reopen/resize',
    ],
  },
  {
    playwright: at(loading, 'the editor loader displays a skeleton and spinner and respects reduced motion'),
    lineage: [
      at(e2eLoading, 'the editor loader displays a skeleton and spinner and respects reduced motion'),
    ],
    dom: [
      at(loadingDom, 'the real editor fallback renders its loading status, spinner and skeleton structure'),
    ],
    proves: [
      'the real fallback renders the Loading editor status, spinner element and multiple skeleton blocks',
      'the copy and settings skeleton regions are hidden from the accessibility tree',
    ],
    remainsBrowser: [
      'holding the actual editor-entry chunk proves the production Suspense boundary stays mounted until its native dynamic import resolves',
      'computed spinner and skeleton animation names switch from spin/pulse to none under native reduced-motion emulation',
      'releasing the chunk mounts the real editor and unmounts the fallback',
    ],
  },
  ...widths.flatMap(width => locales.map((locale): EditorChromeDomRetirement => ({
    playwright: at(actions, `mobile actions fit two header rows at ${width}px in ${locale} and return focus after dialogs`),
    lineage: [
      at(e2eActions, `mobile actions fit two header rows at ${width}px in ${locale} and return focus after dialogs`),
    ],
    dom: [
      at(actionsDom, `the compact header and saved action menu expose independent ${locale === 'en' ? 'en' : 'zh-CN'} copy`),
    ],
    proves: [
      'the real header exposes the localized full/compact back labels and Publish action name',
      'the clean saved draft lists Preview, sync and delete actions, with sync disabled',
    ],
    remainsBrowser: [
      `at ${width}px the back, Publish and More targets share a measured center line and both action targets are at least 44px tall`,
      'the measured header stays under 110px, its status row clears the action row, and the document has no horizontal overflow',
      'the real action Drawer handle is painted at the compact width',
      'Close, Escape and cancelling Delete deliver native focus back to More document actions',
      'the live BlockNote body retains its paragraph after closing the action overlay',
    ],
  }))),
  {
    playwright: at(actions, 'mobile preview keeps the live draft and returns focus when closed'),
    lineage: [
      at(e2eActions, 'mobile preview closes the action drawer and resizing never reopens a dismissed panel'),
    ],
    dom: [
      at(actionsDom, 'the mobile action drawer stays dismissed after widening until manually reopened'),
    ],
    proves: [
      'the real mobile action drawer closes on widening, stays closed on return and can be manually reopened and closed',
    ],
    remainsBrowser: [
      'the real mobile action Drawer routes Preview into the draft reader for the live BlockNote content',
      'closing the preview returns native focus to the mobile actions trigger',
    ],
  },
  {
    playwright: at(actions, 'mobile sync remains disabled when a draft requires conflict resolution'),
    lineage: [
      at(e2eActions, 'mobile sync remains disabled when a draft requires conflict resolution'),
    ],
    dom: [
      at(actionsDom, 'a refused revision save makes the real draft and sync action conflict-disabled'),
    ],
    proves: [
      'a real dirty-draft sync sends the revision route and the 409 response sets the draft conflict state',
      'the Publish and Sync draft now actions are disabled in conflict and the status copy names the conflict',
      'the refused revision save is the only write attempted',
    ],
    remainsBrowser: [
      'the live BlockNote contenteditable continues to render the local conflicting paragraph after the refused save',
    ],
  },
]

/** Execution boundaries for interpreting the editor chrome DOM retirement mapping. */
export const domGatePrerequisites: readonly string[] = [
  'Use the official test:dom config and shared host helpers; jsdom provides no CSS geometry, painted target measurement, native focus or dynamic import boundary.',
  'editor-chrome-support mounts the real header/settings/controllers with a schema-built editor document and change listener, not a BlockNote body.',
  'The original component plan is authoritative for browser residuals; this mapping itself is not browser execution evidence.',
]
