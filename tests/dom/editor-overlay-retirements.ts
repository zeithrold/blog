/* eslint-disable style/max-len -- One row per registered component case with exact native residuals. */
/**
 * Overlay cases retained in the component browser plan.
 *
 * Each `lineage` entry is the earlier E2E case; `playwright` is its current
 * component successor. No overlay case has a DOM successor: these assertions
 * require the real BlockNote side-menu extension, ProseMirror selection or
 * browser geometry/focus that the jsdom layer cannot manufacture.
 */

export type OverlayDomRetirement = {
  readonly playwright: string
  readonly lineage: readonly string[]
  readonly dom: readonly string[]
  readonly proves: readonly string[]
  readonly remainsBrowser: readonly string[]
}

const focus = 'tests/components/specs/editor-overlay-focus.spec.ts'
const geometry = 'tests/components/specs/editor-overlay-geometry.spec.ts'
const races = 'tests/components/specs/editor-overlay-races.spec.ts'
const reopen = 'tests/components/specs/editor-overlay-reopen.spec.ts'
const e2eFocus = 'tests/browser/editor/overlays/editor-overlay-focus.spec.ts'
const e2eGeometry = 'tests/browser/editor/overlays/editor-menu-boundary.spec.ts'
const e2eRaces = 'tests/browser/editor/overlays/editor-overlay-races.spec.ts'
const e2eReopen = 'tests/browser/editor/overlays/editor-overlay-reopen.spec.ts'
const surfaces = ['block', 'colors'] as const
const targets = ['title', 'settings'] as const
const heights = [740, 400] as const

function at(file: string, title: string): string {
  return `${file} :: ${title}`
}

function focusTitle(surface: typeof surfaces[number], target: typeof targets[number]): string {
  return `desktop ${surface} menu outside click keeps the ${target} focus`
}

export const editorOverlayRetirements: readonly OverlayDomRetirement[] = [
  ...surfaces.flatMap(surface => targets.map((target): OverlayDomRetirement => ({
    playwright: at(focus, focusTitle(surface, target)),
    lineage: [
      at(e2eFocus, focusTitle(surface, target)),
    ],
    dom: [],
    proves: [],
    remainsBrowser: [
      surface === 'block'
        ? 'the real BlockNote SideMenuExtension reveals the block menu from a native pointer hover over the table'
        : 'the color menu starts from a real ProseMirror selection established by native editor range selection',
      'an outside pointer event closes the open overlay and delivers native focus to the actual title or slug control',
      'sequential typing inserts at the caret position the browser established and the revision packet carries that field change',
    ],
  }))),
  ...heights.map((height): OverlayDomRetirement => ({
    playwright: at(geometry, `desktop menu avoids sticky headers through table and color changes at ${height}px`),
    lineage: [
      at(e2eGeometry, `desktop menu avoids sticky headers through table and color changes at ${height}px`),
    ],
    dom: [],
    proves: [],
    remainsBrowser: [
      `getBoundingClientRect measures the open block menu below the sticky header and inside the ${height}px viewport`,
      'elementFromPoint confirms the first control is reachable rather than covered',
      'native table header-row/header-column and color-page actions preserve the live BlockNote block',
      'a real 16px page scroll and viewport resize keep the menu in painted bounds',
    ],
  })),
  ...[false, true].map((reverse): OverlayDomRetirement => ({
    playwright: at(races, `old block-menu closes preserve the newer focus with reverse=${String(reverse)}`),
    lineage: [
      at(e2eRaces, `old block-menu closes preserve the newer focus with reverse=${String(reverse)}`),
    ],
    dom: [],
    proves: [],
    remainsBrowser: [
      'the race defers a native overlay close cleanup while a real BlockNote block menu is open',
      reverse
        ? 'releasing newest-first keeps native focus on the title field the user clicked'
        : 'releasing oldest-first keeps the newer menu and its first action natively focused',
      'Escape delivers native focus to the body or clicked title according to the close order',
    ],
  })),
  {
    playwright: at(reopen, 'Escape returns to the body when the open block menu trigger has focus'),
    lineage: [
      at(e2eReopen, 'Escape returns to the body when the open block menu trigger has focus'),
    ],
    dom: [],
    proves: [],
    remainsBrowser: [
      'native pointer hover over the table cell reveals the BlockNote side-menu trigger',
      'the block menu opens with its first action natively focused and stays open while the trigger owns focus',
      'Escape closes the overlay and delivers native focus to the live document body',
    ],
  },
]

/** Execution boundaries for the overlay cases kept in the component browser plan. */
export const domGatePrerequisites: readonly string[] = [
  'The official jsdom harness supplies no layout, pointer capture, ProseMirror selection, painted geometry or native focus delivery.',
  'A synthetic block-menu row would not be the real BlockNote SideMenuExtension target and cannot prove the native editor selection lifecycle.',
  'All nine component cases therefore remain in Playwright until a jsdom-accessible product boundary can prove their state without a product seam.',
]
