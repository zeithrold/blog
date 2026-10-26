/* eslint-disable style/max-len -- One row per registered Playwright case, with verbatim references on one line. */
/**
 * Where the editor's draft-preview and local-recovery Playwright cases go.
 *
 * The jsdom successors are `tests/dom/history-preview-remaining-entries.test.tsx` and
 * `tests/dom/history-preview-remaining-recovery.test.tsx`. They mount the real
 * preview provider, dialog, reader, notices and translations; the only substituted
 * boundary is the editor's `snapshot()` (the live editor behind the preview) and
 * the `Recovery` value a workspace normally reads from IndexedDB. `proves` names
 * only what those cases assert, `remainsBrowser` names the fact that keeps the
 * Playwright case. Follow-ups name behavior neither the original nor replacement
 * cases covered, not missing migration coverage. A browser-only reason never
 * grants permission to keep the rest of a case.
 *
 * This file is data, not a test: `vitest.dom.config.ts` includes only the
 * `*.test.tsx` files under `tests/dom`.
 */

export type PreviewRetirement = {
  /** The Playwright case as it is registered today: `file :: title`. */
  readonly playwright: string
  /** jsdom cases that prove part of it. */
  readonly dom: readonly string[]
  /** Original assertions the jsdom cases prove. */
  readonly proves: readonly string[]
  /** Assertions of the same case that survive only in a browser. */
  readonly remainsBrowser: readonly string[]
}

const preview = 'tests/components/specs/editor-history-remaining-preview.spec.ts'
const entries = 'tests/dom/history-preview-remaining-entries.test.tsx'
const recovery = 'tests/dom/history-preview-remaining-recovery.test.tsx'

function at(file: string, title: string): string {
  return `${file} :: ${title}`
}

const widths = [
  320,
  390,
  1440,
]
const narrow = [320, 390]
const locales = ['en', 'zh'] as const

const previewProves = [
  'the real Content tab renders exactly one draft-preview entry and no saved-revision preview link',
  'the Content tab entry and the desktop action menu open the same single preview dialog',
  'the compact action drawer opens the same single preview dialog and closes behind it',
  'the reader region renders the current unsaved draft and not the saved revision',
  'a complete draft shows no preview error',
  'closing the preview removes the only dialog, and reopening it reads the current draft again',
  'previewing from any entry issues no request, so it publishes nothing',
]

const previewRemains = [
  'the real settings drawer and Content tab around that section, and the Radix menu and compact drawer: the dialog and close-button horizontal bounds, the viewport fit and the drawer at 320/390px are measured there',
  'the preview reader shows the paragraph typed into the live BlockNote editor, which is the snapshot source the jsdom case supplies',
  'closing the preview returns native focus to the entry that opened it, and Escape closes it from the menu',
  'neither entry recreates the editor element that holds the unsaved paragraph (element identity), and the held save then completes',
]

/** Additional coverage beyond the original cases, not a retirement prerequisite. */
export const previewFollowUps = [
  'an edit made while the preview is open re-reads the snapshot and notifies the opened reader; the jsdom editor change feed is a no-op and the original case never asserted that state',
]

const recoveryProves = [
  'the notice names the stored local copy and shows its own description',
  'its time element carries the stored instant and a visible year under the Saved label',
  'the tone icon and both action icons are present and decorative',
  'both actions are named Open recovered draft and Dismiss',
  'dismissing the notice removes it, and reopening it hands the stored document and its base revision to the session',
  'reading or dismissing the notice issues no request',
]

const recoveryRemains = [
  'the copy is written and read back through the real IndexedDB schema across a reload',
  'after dismissing and reloading, the notice is offered again: the stored copy survives the reload',
  'the notice and its actions stay inside the compact viewport with 44px targets, and the tone and action icons are painted',
  'dismissing keeps the server paragraph, and opening the copy applies it to the live editor',
]

const previewRetirements: readonly PreviewRetirement[] = widths.flatMap(width => locales.map((locale): PreviewRetirement => {
  // The Playwright case names the locale `zh`; jsdom renders `zh-CN`.
  const rendered = locale === 'en' ? 'en' : 'zh-CN'
  return {
    playwright: at(preview, `both preview entries show the unsaved draft without remounting at ${width}px in ${locale}`),
    dom: [
      at(entries, `opens one draft preview from the content tab and the action menu in ${rendered}`),
      at(entries, `closes the draft preview and reopens it with the current draft in ${rendered}`),
      at(entries, `offers exactly one draft preview entry in the content tab in ${rendered}`),
      at(entries, `opens one draft preview from the compact action drawer in ${rendered}`),
    ],
    proves: previewProves,
    remainsBrowser: previewRemains,
  }
}))

const recoveryRetirements: readonly PreviewRetirement[] = narrow.flatMap(width => locales.map((locale): PreviewRetirement => {
  const rendered = locale === 'en' ? 'en' : 'zh-CN'
  return {
    playwright: at(preview, `local recovery is readable, dismissible and recoverable at ${width}px in ${locale}`),
    dom: [
      at(recovery, `offers the stored local copy with its saved time and both actions in ${rendered}`),
      at(recovery, `reopens the stored local copy from the notice in ${rendered}`),
    ],
    proves: recoveryProves,
    remainsBrowser: recoveryRemains,
  }
}))

export const previewRetirementTable: readonly PreviewRetirement[] = [
  ...previewRetirements,
  ...recoveryRetirements,
]
