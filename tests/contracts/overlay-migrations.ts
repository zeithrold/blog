/* eslint-disable style/max-len -- Verbatim case references stay on one line. */
import type { CaseMigration } from './types'

/**
 * Where the retired editor overlay browser cases now run.
 *
 * `legacy` names the E2E cases that owned the assertion, `component` names the
 * component browser case that proves it on the production editor entry with the
 * real BlockNote side menu, popover and formatting toolbar, and `proves` lists
 * the original assertions that case now covers. A case stays in E2E when only
 * the built application can prove it: a routed navigation that has to outlive a
 * held overlay close.
 *
 * The case-owned revision ack proves what the client sent, not what D1 stored.
 * Stored title, slug and table header round trips remain with the retained
 * editor save/reload cases in the migration ledger, which this file does not
 * restate.
 */
const legacy = {
  geometry: 'tests/browser/editor/overlays/editor-menu-boundary.spec.ts',
  focus: 'tests/browser/editor/overlays/editor-overlay-focus.spec.ts',
  reopen: 'tests/browser/editor/overlays/editor-overlay-reopen.spec.ts',
  races: 'tests/browser/editor/overlays/editor-overlay-races.spec.ts',
} as const

const component = {
  geometry: 'tests/components/specs/editor-overlay-geometry.spec.ts',
  focus: 'tests/components/specs/editor-overlay-focus.spec.ts',
  reopen: 'tests/components/specs/editor-overlay-reopen.spec.ts',
  races: 'tests/components/specs/editor-overlay-races.spec.ts',
} as const

function c(file: string, title: string): string {
  return `${file} :: ${title}`
}

const heights = [740, 400] as const
function geometryTitle(height: number): string {
  return `desktop menu avoids sticky headers through table and color changes at ${height}px`
}

const surfaces = ['block', 'colors'] as const
const targets = ['title', 'settings'] as const
function focusTitle(surface: typeof surfaces[number], target: typeof targets[number]): string {
  return `desktop ${surface} menu outside click keeps the ${target} focus`
}

export const overlayMigrations: readonly CaseMigration[] = [
  {
    id: 'editor.overlay-geometry',
    legacy: heights.map(height => c(legacy.geometry, geometryTitle(height))),
    component: heights.map(height => ({
      case: c(component.geometry, geometryTitle(height)),
      proves: [
        'the open block menu clears the sticky workspace header and both viewport edges',
        'the first control is hit-testable at the point the pointer would reach',
        'switching the header row, the header column and the colour page keeps those bounds',
        'a 16px window scroll and a resize to the other height keep those bounds',
        'the table and colour changes reach their saved state before the case ends',
      ],
    })),
    retained: [],
  },
  {
    id: 'editor.overlay-focus',
    legacy: surfaces.flatMap(surface => targets.map(target => c(legacy.focus, focusTitle(surface, target)))),
    component: surfaces.flatMap(surface => targets.map(target => ({
      case: c(component.focus, focusTitle(surface, target)),
      proves: [
        `the ${surface === 'block' ? 'block menu' : 'colour dialog'} stays open until the outside click and then unmounts`,
        `the ${target === 'title' ? 'title' : 'settings panel slug'} field keeps focus after that click`,
        'one typed insertion lands at the caret the click left and keeps the expected value',
        `the revision packet carries the edited ${target === 'title' ? 'title' : 'slug'}`,
      ],
    }))),
    retained: [],
  },
  {
    id: 'editor.overlay-reopen',
    legacy: [
      c(legacy.reopen, 'Escape returns to the body when the open block menu trigger has focus'),
    ],
    component: [
      {
        case: c(component.reopen, 'Escape returns to the body when the open block menu trigger has focus'),
        proves: [
          'the menu opens with its first action focused',
          'focusing the trigger keeps the menu open and keeps focus on the trigger',
          'Escape closes the menu and returns focus to the document body',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'editor.overlay-races',
    legacy: [
      ...[false, true].map(reverse =>
        c(legacy.races, `old block-menu closes preserve the newer focus with reverse=${String(reverse)}`)),
      c(legacy.races, 'a delayed mobile publication locator leaves the new route and input alone'),
    ],
    component: [false, true].map(reverse => ({
      case: c(component.races, `old block-menu closes preserve the newer focus with reverse=${String(reverse)}`),
      proves: [
        'a held focus cleanup from an older menu cannot close a newer open menu',
        `releasing the held closes ${
          reverse ? 'newest first leaves the title field the author clicked focused' : 'oldest first keeps the newer menu and its first action focused'
        }`,
        'the case ends with no page error and the document saved',
      ],
    })),
    retained: [
      {
        cases: [
          c(legacy.races, 'a delayed mobile publication locator leaves the new route and input alone'),
        ],
        reason: 'The held close is released after the routed mobile menu navigates to Tags, so only the built application can prove the new route, its focused input and the unchanged URL.',
      },
    ],
  },
]
