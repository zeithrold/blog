/* eslint-disable max-lines -- One flat table maps every retired block case to its component case. */
/* eslint-disable style/max-len -- Verbatim case references stay on one line. */
import type { CaseMigration } from './types'

/**
 * The remaining native block slice: reachable block controls, the compact action
 * drawer, block colors, the Chinese slash palette and the mobile block gutter.
 *
 * `legacy` names the E2E case that owned the assertion, `component` names the case
 * in `tests/components/specs/editor-block-remaining.spec.ts` that proves it on the
 * production editor entry (real BlockNote, real side menus, real CSS, only the HTTP
 * boundary replaced), and `proves` lists the original assertions that case covers.
 *
 * `retained` keeps the two representatives that only the built Worker can prove:
 * both block color properties and an inserted-then-deleted nested structure
 * survive a real save, a real document read and a reload. Everything else is native
 * browser behavior the component entry already runs in Chromium and WebKit.
 */

const F = {
  actions: 'tests/browser/editor/blocks/block-actions.spec.ts',
  layout: 'tests/browser/editor/blocks/block-action-layout.spec.ts',
  colors: 'tests/browser/editor/blocks/block-color-drawer.spec.ts',
  palette: 'tests/browser/editor/blocks/command-palette.spec.ts',
  gap: 'tests/browser/editor/blocks/mobile-block-gap.spec.ts',
  component: 'tests/components/specs/editor-block-remaining.spec.ts',
} as const

function c(file: string, title: string): string {
  return `${file} :: ${title}`
}

function reachTitle(width: number, locale: 'en' | 'zh'): string {
  return `block controls stay reachable without covering text after scrolling at ${width}px in ${locale}`
}

function reach(width: number, locale: 'en' | 'zh'): string {
  return c(F.actions, reachTitle(width, locale))
}

function reachCase(width: number, locale: 'en' | 'zh'): string {
  return c(F.component, reachTitle(width, locale))
}

function colorVariant(width: number, locale: 'en' | 'zh'): string {
  return c(F.colors, `color drawer fits ${width}px in ${locale} and persists both colors on the selected block`)
}

const retainedColors = colorVariant(320, 'en')
const retainedGap = c(F.gap, 'the gap add control inserts after its block and deletion preserves its neighbours')

const reachProves = [
  'the add and menu controls stay inside the viewport and clear of the paragraph text at the top and bottom of a 24-block document',
  'on a phone the controls keep a 44px touch target below the block and the handle opens a dialog instead of dragging',
  'the action drawer lists Delete and Colors with their icons, stays in the viewport and closes on Escape',
  'the desktop action menu is not mounted at the compact width',
]

const drawerGeometryProves = [
  'the drawer spans the viewport, stays under 90% of its height, sits on the bottom edge and keeps a visible handle',
  'both actions keep a 44px target and the color page opens in the same single dialog',
  'the Text and Background groups each name ten swatches, and every swatch is a 44px target',
  'the chosen text and background colors reach the revision packet on the selected block only',
  'the pressed swatches stay marked, closing the drawer returns focus to the body and the editor node stays connected',
]

function menuRowProves(locale: 'English' | 'Chinese'): string[] {
  return [
    'four action rows stack in one column, share the list width and keep a touch or dense row height',
    'each row renders its own label, its own icon and the left-aligned row layout',
    `the ${locale} Alt+F10 keyboard help shows beside the desktop menu and stays hidden in the compact drawer`,
    'focus moves from Delete to Colors with the focus background and the header row and column toggle by keyboard and pointer',
    'Escape closes the menu and the table keeps its three header cells',
  ]
}

export const blockRemainingMigrations: readonly CaseMigration[] = [
  {
    id: 'editor.blocks-controls-reach',
    legacy: [
      reach(320, 'en'),
      reach(320, 'zh'),
      reach(390, 'en'),
      reach(390, 'zh'),
    ],
    component: [
      {
        case: reachCase(320, 'en'),
        proves: reachProves,
      },
      {
        case: reachCase(320, 'zh'),
        proves: reachProves,
      },
      {
        case: reachCase(390, 'en'),
        proves: reachProves,
      },
      {
        case: reachCase(390, 'zh'),
        proves: reachProves,
      },
    ],
    retained: [],
  },
  {
    id: 'editor.blocks-reduced-motion',
    legacy: [
      c(F.actions, 'reduced motion keeps narrow block controls and keyboard operation available'),
    ],
    component: [
      {
        case: c(F.component, 'reduced motion keeps narrow block controls and keyboard operation available'),
        proves: [
          'the reduced-motion handle has no transition duration and no transition property',
          'Enter on the focused handle opens the drawer, which stays in the viewport',
          'focus starts on Delete, moves to Colors and back, and Escape closes the drawer without touching the body text',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'editor.blocks-handle-gesture',
    legacy: [
      c(F.actions, 'releasing a pointer over the block handle does not open a menu unless the gesture started there'),
    ],
    component: [
      {
        case: c(F.component, 'releasing a pointer over the block handle does not open a menu unless the gesture started there'),
        proves: [
          'a press that starts on the paragraph and releases over the handle opens no menu and leaves it collapsed',
          'a click on the handle opens the desktop menu and Escape restores the paragraph text',
          'a drag that starts on the handle and releases outside cancels, and the handle follows the next hovered block',
          'deleting through the handle removes only that block and the packet carries the two remaining blocks',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'editor.blocks-controls-resize',
    legacy: [
      c(F.actions, 'resizing across the breakpoint keeps the controls and menu in the viewport'),
    ],
    component: [
      {
        case: c(F.component, 'resizing across the breakpoint keeps the controls and menu in the viewport'),
        proves: [
          'at 700px and below the add control sits under its block; above it, in the gutter left of the text',
          'each resize keeps both controls reachable and the focused handle opens its matching surface',
          'the drawer or menu stays in the viewport, keeps focus order and closes on Escape back to the body',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'editor.blocks-colors-touch',
    legacy: [
      colorVariant(320, 'en'),
      colorVariant(320, 'zh'),
      colorVariant(390, 'en'),
      colorVariant(390, 'zh'),
    ],
    component: [
      {
        case: c(F.component, 'touch color drawer fits 320px in zh and marks the chosen block colors'),
        describe: ['touch color drawer'],
        proves: drawerGeometryProves,
      },
      {
        case: c(F.component, 'touch color drawer fits 390px in en and marks the chosen block colors'),
        describe: ['touch color drawer'],
        proves: drawerGeometryProves,
      },
    ],
    retained: [
      {
        cases: [retainedColors],
        reason: 'The real Worker keeps both color properties on the selected block, the neighbors keep the defaults and the reload renders the stored colors: the one stored-color representative for the block suite.',
      },
    ],
    notMigrated: [
      {
        cases: [
          colorVariant(390, 'zh'),
        ],
        reason: 'The drawer contract is already proved at the narrowest width with the wider Chinese labels (320px zh) and at the wider phone width (390px en); this variant repeats both dimensions.',
      },
    ],
  },
  {
    id: 'editor.blocks-colors-focus',
    legacy: [
      c(F.colors, 'color drawers keep focus and release the editor on Escape and desktop resize'),
    ],
    component: [
      {
        case: c(F.component, 'color drawers keep focus and release the editor on Escape and desktop resize'),
        proves: [
          'focus starts on Delete, moves to Colors and opens the color page with Back focused',
          'tabbing from Back reaches the first swatch and from Close wraps inside the drawer instead of escaping it',
          'Escape closes the drawer, returns focus to the body and leaves the editor node connected',
          'resizing to the desktop width removes the drawer, keeps the editor connected and opens the desktop Colors menu',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'editor.blocks-colors-desktop',
    legacy: [
      c(F.colors, 'desktop block actions show icons and keep matrix color selection and persistence'),
    ],
    component: [
      {
        case: c(F.component, 'desktop block actions show icons and keep matrix color selection and persistence'),
        proves: [
          'the desktop menu shows icons on Delete and Colors and stays in the viewport',
          'choosing blue in the color matrix marks the selected block and the packet carries blue on that block only',
          'the other blocks keep the default text and background colors in the same packet',
        ],
      },
    ],
    retained: [
      {
        cases: [retainedColors],
        reason: 'The stored round-trip this case ended with is the retained touch color representative: D1 keeps the chosen colors and the reload renders them on the selected block only. The matrix interaction itself is proved against the real component.',
      },
    ],
  },
  {
    id: 'editor.blocks-slash-chinese',
    legacy: [
      c(F.palette, 'Chinese slash commands show readable rich content and preserve English search aliases'),
    ],
    component: [
      {
        case: c(F.component, 'Chinese slash commands show readable rich content and preserve English search aliases'),
        proves: [
          'the Chinese palette lists the seven rich blocks in order and names its last group 扩展内容',
          'typing the English alias callout narrows the palette to one option with its Chinese title, description and icon',
          'the body keeps focus, Enter replaces the empty paragraph with the callout block and the palette closes',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'editor.blocks-menu-rows',
    legacy: [
      c(F.layout, 'block action menu rows at 1440px in en'),
      c(F.layout, 'block action menu rows at 1440px in zh'),
      c(F.layout, 'block action menu rows at 390px in en'),
      c(F.layout, 'block action menu rows at 390px in zh'),
      c(F.layout, 'block action menu rows at 320px in en'),
      c(F.layout, 'block action menu rows at 320px in zh'),
    ],
    component: [
      {
        case: c(F.component, 'block action menu rows at 1440px in en'),
        proves: [
          ...menuRowProves('English'),
          'the open menu passes an accessibility scan at desktop width',
        ],
      },
      {
        case: c(F.component, 'block action menu rows at 1440px in zh'),
        proves: menuRowProves('Chinese'),
      },
      {
        case: c(F.component, 'block action menu rows at 390px in en'),
        proves: [
          ...menuRowProves('English'),
          'the open drawer passes an accessibility scan at the tablet width',
        ],
      },
      {
        case: c(F.component, 'block action menu rows at 390px in zh'),
        proves: menuRowProves('Chinese'),
      },
      {
        case: c(F.component, 'block action menu rows at 320px in en'),
        proves: menuRowProves('English'),
      },
      {
        case: c(F.component, 'block action menu rows at 320px in zh'),
        proves: menuRowProves('Chinese'),
      },
    ],
    retained: [],
  },
  {
    id: 'editor.blocks-mobile-spacing',
    legacy: [
      c(F.gap, 'mobile blocks use full width and stable control gaps at 390px'),
      c(F.gap, 'mobile blocks use full width and stable control gaps at 320px'),
    ],
    component: [
      {
        case: c(F.component, 'mobile blocks use full width and stable control gaps at 390px'),
        proves: [
          'the body keeps its 16px side padding and the paragraphs keep a full-width line box',
          'top-level blocks sit 48px apart and nested list items 12px apart, with room below the last block',
          'the block controls of the first, last and nested blocks sit in the gutter between blocks with 44px targets',
          'showing and hiding those controls never shifts the document layout and writes no revision',
        ],
      },
      {
        case: c(F.component, 'mobile blocks use full width and stable control gaps at 320px'),
        proves: [
          'the body keeps its 16px side padding and the paragraphs keep a full-width line box',
          'top-level blocks sit 48px apart and nested list items 12px apart, with room below the last block',
          'the block controls of the first, last and nested blocks sit in the gutter between blocks with 44px targets',
          'showing and hiding those controls never shifts the document layout and writes no revision',
        ],
      },
    ],
    retained: [
      {
        cases: [retainedGap],
        reason: 'The reload these cases ended with is the retained structure representative, which saves the inserted and deleted structure through the real Worker, reloads and compares the stored document.',
      },
    ],
  },
  {
    id: 'editor.blocks-gap-insert',
    legacy: [retainedGap],
    component: [
      {
        case: c(F.component, 'the gap add control inserts after its block and deletion preserves its neighbours'),
        describe: ['touch block gap insertion'],
        proves: [
          'a tap on a block shows the gap controls and the add control works outside its smaller visible glyph',
          'the heading inserts after that block only and its typed text reaches the packet between the untouched neighbours',
          'deleting the heading restores the original blocks and deleting the nested item leaves one sibling',
        ],
      },
    ],
    retained: [
      {
        cases: [retainedGap],
        reason: 'Inserting a heading in the gap, deleting it and deleting a nested child is a real Worker write path: the stored structure and its reload are the one nested-structure representative for the block suite.',
      },
    ],
  },
]
