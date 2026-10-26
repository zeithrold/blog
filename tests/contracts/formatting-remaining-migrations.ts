/* eslint-disable style/max-len -- Verbatim case references stay on one line. */

import type { CaseMigration } from './types'

/**
 * The remaining formatting slice: the floating toolbar's geometry and inventory,
 * the compact options drawer, the breakpoint crossing, the multiline/backward
 * position model, the virtual-keyboard branch, the refocus race and the rapid
 * resize race.
 *
 * `legacy` cases are deleted with their real-component replacement. `retained`
 * keeps only the few stored-reload representatives: the built application is the
 * only layer that saves a revision and reloads it, so the bold, strike, colour,
 * alignment and link results survive a real page reload there.
 */

const F = {
  toolbar: 'tests/browser/editor/formatting/format-toolbar.spec.ts',
  position: 'tests/browser/editor/formatting/formatting-position.spec.ts',
  races: 'tests/browser/editor/formatting/formatting-position-races.spec.ts',
  component: 'tests/components/specs/editor-format-remaining.spec.ts',
} as const

const widths = [
  320,
  390,
  700,
  701,
  1440,
] as const
const locales = ['en', 'zh'] as const

function c(file: string, title: string): string {
  return `${file} :: ${title}`
}

function bounded(width: number, locale: string): string {
  return `floating formatting is bounded at ${width}px in ${locale} and bold affects only its selected range`
}
function mobileAdvanced(width: number): string {
  return `mobile advanced formatting preserves selection and native actions at ${width}px`
}
function positionAt(width: number): string {
  return `formatting follows multiline and backward cross-block selections at ${width}px`
}
function accessibilityAt(width: number, locale: string): string {
  return `formatting controls are accessible at ${width}px in ${locale}`
}

const boundedProves = [
  'the floating toolbar stays inside the viewport and its width cap at this width',
  'the compact layout keeps five 44px touch targets on one row at the measured position',
]
const advancedProves = [
  'the drawer opens with Close focused, Tab reaches Strike, and native selection survives the Escape that dismisses it',
  'both compact widths keep the drawer, colour target and URL field inside their measured bounds with 44px targets',
]

const retainedBounded = [
  c(F.toolbar, bounded(1440, 'en')),
  c(F.toolbar, bounded(320, 'zh')),
]
const retainedAdvanced = [
  c(F.toolbar, mobileAdvanced(390)),
]

export const formattingRemainingMigrations: readonly CaseMigration[] = [
  {
    id: 'editor.formatting-toolbar',
    legacy: widths.flatMap(width => locales.map(locale => c(F.toolbar, bounded(width, locale)))),
    component: widths.flatMap(width => locales.map(locale => ({
      case: c(F.component, bounded(width, locale)),
      proves: boundedProves,
    }))),
    retained: [
      {
        cases: retainedBounded,
        reason: 'Only the built application saves the revision and reloads it: these keep the wide and compact stored-bold reload proof.',
      },
    ],
  },
  {
    id: 'editor.formatting-advanced',
    legacy: [
      c(F.toolbar, mobileAdvanced(320)),
      c(F.toolbar, mobileAdvanced(390)),
    ],
    component: [
      {
        case: c(F.component, mobileAdvanced(320)),
        proves: advancedProves,
      },
      {
        case: c(F.component, mobileAdvanced(390)),
        proves: advancedProves,
      },
    ],
    retained: [
      {
        cases: retainedAdvanced,
        reason: 'The stored strike, colour, alignment and link survive a real reload only through the Worker; the 390px case keeps that proof.',
      },
    ],
  },
  {
    id: 'editor.formatting-breakpoint',
    legacy: [
      c(F.toolbar, 'crossing the mobile breakpoint releases its drawer and retains the editor selection'),
    ],
    component: [
      {
        case: c(F.component, 'crossing the mobile breakpoint releases its drawer and retains the editor selection'),
        proves: [
          'the selection survives both crossings of the 701px breakpoint',
          'each layout keeps its bounded toolbar controls at the measured position',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'editor.formatting-accessibility',
    legacy: [
      c(F.toolbar, accessibilityAt(320, 'zh')),
      c(F.toolbar, accessibilityAt(1440, 'en')),
    ],
    component: [
      {
        case: c(F.component, accessibilityAt(320, 'zh')),
        describe: ['formatting accessibility scanner'],
        proves: [
          'the compact floating toolbar passes Axe under reduced motion',
          'the options drawer passes Axe with a zero-duration animation',
        ],
      },
      {
        case: c(F.component, accessibilityAt(1440, 'en')),
        describe: ['formatting accessibility scanner'],
        proves: ['the wide floating toolbar passes Axe under reduced motion'],
      },
    ],
    retained: [],
  },
  // The retained touch formatting case stays with `editor.formatting` in
  // `sourceMigrations`, which already keeps its Worker reload proof.
  {
    id: 'editor.formatting-position',
    legacy: [
      c(F.position, positionAt(700)),
      c(F.position, positionAt(701)),
      c(F.position, positionAt(1024)),
    ],
    component: [
      c(F.component, positionAt(700)),
      c(F.component, positionAt(701)),
      c(F.component, positionAt(1024)),
    ].map(entry => ({
      case: entry,
      proves: [
        'forward and backward cross-block selections keep the toolbar next to the current range',
        'scrolling, the viewport resize and the header gap keep the placement while the selection is unchanged',
        'the surface passes Axe against real computed styles and native focus returns to the body',
      ],
    })),
    retained: [],
  },
  {
    id: 'editor.formatting-keyboard',
    legacy: [
      c(F.position, 'keyboard viewport keeps the native toolbar and returns to selection positioning'),
    ],
    component: [
      {
        case: c(F.component, 'keyboard viewport keeps the native toolbar and returns to selection positioning'),
        describe: ['native virtual keyboard branch'],
        proves: [
          'the virtual keyboard branch mounts the native mobile toolbar over the retained range',
          'restoring the viewport returns to selection-positioned floating placement',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'editor.formatting-refocus',
    legacy: [
      c(F.position, 'refocusing during the close animation measures the retained selection again'),
    ],
    component: [
      {
        case: c(F.component, 'refocusing during the close animation measures the retained selection again'),
        proves: ['refocusing through the title field during the close animation re-measures the retained selection'],
      },
    ],
    retained: [],
  },
  {
    id: 'editor.formatting-races',
    legacy: [
      c(F.races, 'rapid viewport changes finish at the current selection without stale placement'),
    ],
    component: [
      {
        case: c(F.component, 'rapid viewport changes finish at the current selection without stale placement'),
        proves: [
          'rapid width changes settle on the current selection without stale placement',
          'the toolbar stays in view below the header after the race',
        ],
      },
    ],
    retained: [],
  },
]
