/* eslint-disable style/max-len -- Verbatim case references stay on one line. */
import type { AdminMigrationRecord } from './admin-migrations'

/**
 * Where the remaining editor link browser cases now run.
 *
 * The component cases mount the production editor entry (real BlockNote, link dialog, formatting
 * toolbar and drawer, draft coordinator) over an explicit HTTP boundary: the run reads its
 * document from the case and a save is answered with the shared acknowledgement, so a case
 * asserts the revision packet the client sent rather than storage.
 *
 * Four E2E cases stay because only the built application can prove them: the normalized
 * destination and its Undo against the stored document (already registered by `source-migrations`
 * under `editor.links`), the unlinked URL-shaped text read back after a real reload, the relative
 * destination on the published page, and a delayed overlay close while a real route change owns
 * the focused input. Every other assertion keeps a destination in the component cases below.
 *
 * The shortcut matrix collapses the retired `Control`/`Meta` pairs into one case per width and
 * locale that presses both modifiers, and the four adjacent-selection cases collapse into one
 * desktop case that keeps each selection shape as its own round.
 *
 * Two matrix rounds keep the whole round: a typed destination submitted with `Enter` closes the
 * editor, returns native focus to the body and links exactly the captured range. Only a real
 * browser performs the implicit form submission, so that positive cannot move to the DOM layer.
 * The other rounds keep the narrowed cancel and Escape residual and say so.
 */
const F = {
  keyboard: 'tests/browser/editor/links/link-keyboard-command.spec.ts',
  extraEntry: 'tests/browser/editor/links/link-extra-entry.spec.ts',
  lifecycle: 'tests/browser/editor/links/link-lifecycle.spec.ts',
  targets: 'tests/browser/editor/links/link-targets.spec.ts',
  shortcut: 'tests/components/specs/editor-link-remaining-keyboard.spec.ts',
  entry: 'tests/components/specs/editor-link-remaining-entry.spec.ts',
  targetsComponent: 'tests/components/specs/editor-link-remaining-targets.spec.ts',
  focus: 'tests/components/specs/editor-link-remaining-focus.spec.ts',
} as const

function c(file: string, title: string): string {
  return `${file} :: ${title}`
}

/** A fully retired node keeps its identity here; the assertions run in the DOM layer. */
const historicalLink = 'historical component identity; its assertions now run in the DOM layer'

// Both product modifiers per retired pair become one round that presses each of them. The desktop
// width and the narrowest compact width keep the full round because they reach the editor through
// different controllers, the floating toolbar and the compact drawer; the other widths repeat the
// same controller branch.
const enterRounds = new Set(['1440:en', '320:zh'])
const shortcutRounds = [
  320,
  390,
  1440,
].flatMap(width => ['en', 'zh'].map(locale => ({
  case: c(F.shortcut, `Control+K and Meta+K open, cancel, save and Undo at ${width}px in ${locale}`),
  proves: enterRounds.has(`${width}:${locale}`)
    ? [
        'each modifier opens exactly one Create link editor with its destination focused and inside the viewport',
        'cancel and Escape close it and restore the captured range to the body',
        'a typed destination submitted with Enter closes the editor, returns native focus to the body, links exactly the captured range and Undo removes it',
      ]
    : [
        'a native selection drives the editor, each modifier opens exactly one Create link editor with its destination focused and inside the viewport, and cancel and Escape close it without a write and restore the captured range to the body',
        'a typed destination saved by clicking Save and its Undo are proved by the DOM successor, not by this residual',
      ],
})))

const shortcutPairs = [320, 390].flatMap(width => ['en', 'zh'].flatMap(locale => [
  'Control',
  'Meta',
].map(modifier => c(F.keyboard, `closed options allow ${modifier}+K at ${width}px in ${locale} with cancel, save and Undo`))))

// A synthetic key event never performs the platform default edit, so a browser residual has to prove
// the editor cancels that default. The desktop and the narrowest compact width keep that proof
// through different controllers; the third width is the same compact controller branch.
const suppressedSelections = [
  { width: 1440, locale: 'en' },
  { width: 390, locale: 'en' },
  { width: 320, locale: 'zh' },
] as const

const suppressedProves: Readonly<Record<string, readonly string[]>> = {
  '1440:en': [
    'a collapsed caret after a real ArrowRight keeps real Control+K and Meta+K inert: the editor cancels the chord so the platform text-editing default never runs, and there is no editor, no destination field and no write, with the paragraph text and the caret unchanged',
    'a confirmed non-empty DOM and model selection remains unchanged through fixture composition lifecycle and real Control+K and Meta+K; this proves the application composition guard on both engines, not operating-system IME injection',
  ],
  '320:zh': [
    'a collapsed caret after a real ArrowRight keeps real Control+K and Meta+K inert in the compact layout: the editor cancels the chord, and there is no editor, no destination field and no write, with the paragraph text and the caret unchanged',
    'a confirmed non-empty DOM and model selection remains unchanged through fixture composition lifecycle and real Control+K and Meta+K on the compact controller; this is not operating-system IME evidence',
  ],
}

const suppressedCases = suppressedSelections.map(({ width, locale }) => ({
  case: c(F.shortcut, `empty and composing selections suppress the shortcut at ${width}px in ${locale}`),
  proves: suppressedProves[`${width}:${locale}`] ?? [historicalLink],
}))

export const linkRemainingMigrations: readonly AdminMigrationRecord[] = [
  {
    id: 'editor.links-shortcut',
    legacy: [
      ...shortcutPairs,
      c(F.keyboard, 'desktop link shortcut opens one editor at 1440px in en'),
      c(F.keyboard, 'desktop link shortcut opens one editor at 1440px in zh'),
    ],
    component: shortcutRounds,
    retained: [],
  },
  {
    id: 'editor.links-shortcut-guards',
    legacy: [
      c(F.extraEntry, 'desktop empty and composing selections suppress link shortcuts without deleting text'),
      c(F.keyboard, 'empty selection and composition reject Mod-K at 320px in zh'),
      c(F.keyboard, 'empty selection and composition reject Mod-K at 390px in en'),
    ],
    component: suppressedCases,
    retained: [],
  },
  {
    id: 'editor.links-destination',
    legacy: [
      c(F.keyboard, 'invalid link URLs keep the draft unchanged and a corrected bare domain saves safely'),
    ],
    component: [
      {
        case: c(F.shortcut, 'a corrected bare domain saves after refusals at 390px in zh'),
        proves: [historicalLink],
      },
    ],
    retained: [],
  },
  {
    id: 'editor.links-busy',
    legacy: [
      c(F.keyboard, 'pending operations make the mobile editor read-only and reject link shortcuts'),
    ],
    component: [
      {
        case: c(F.entry, 'a held publication makes the compact editor read-only and rejects link shortcuts'),
        proves: [historicalLink],
      },
    ],
    retained: [],
  },
  {
    id: 'editor.links-touch-entry',
    legacy: [
      c(F.extraEntry, 'the mobile formatting drawer hands a touch selection to the link dialog'),
    ],
    component: [
      {
        case: c(F.entry, 'the mobile formatting drawer hands a touch selection to the link dialog in dark zh'),
        describe: ['touch link entry'],
        proves: [
          'the touch selection survives the drawer-to-dialog handoff and Save: the destination field takes focus and real typing, the dialog closes, native focus returns to the body, only the selected phrase is linked in rendered content and in the saved packet',
          'the dialog passes Axe once over real computed styles and the accessibility tree',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'editor.links-selections',
    legacy: [
      c(F.targets, 'linking partial link preserves all other characters and styles'),
      c(F.targets, 'linking plain text after a link preserves all other characters and styles'),
      c(F.targets, 'linking one adjacent link character preserves all other characters and styles'),
      c(F.targets, 'linking across adjacent links preserves all other characters and styles'),
      c(F.targets, 'linking mobile partial link preserves all other characters and styles'),
    ],
    component: [
      {
        case: c(F.targetsComponent, 'linking partial, following and crossing selections preserves all other characters and styles at 1440px'),
        proves: [
          'four real native ranges (lp inside the first link, Plain after it, B inside the second link, haBe across adjacent links) each drive Meta+K and Save',
          'only the selected graphemes gain the destination in the rendered link map and in the saved packet, the neighbouring characters and both adjacent links keep theirs, styles are unchanged, and Undo restores the original',
        ],
      },
      {
        case: c(F.targetsComponent, 'linking a mobile partial link preserves all other characters and styles at 320px'),
        proves: [
          'the compact lp range drives the drawer entry and Save, only that range gains the destination in rendered content and in the packet, its neighbours keep theirs, and Undo restores the original',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'editor.links-edit-unlink',
    legacy: [
      c(F.targets, 'existing link edits and unlink target the chosen adjacent link at 1440px'),
      c(F.targets, 'existing link edits and unlink target the chosen adjacent link at 320px'),
      c(F.targets, 'unlink keeps URL-shaped text unlinked after saving and reloading'),
    ],
    component: [
      {
        case: c(F.targetsComponent, 'existing link edits and unlink target the chosen adjacent link at 1440px'),
        proves: [
          'a real click on the second adjacent link captures that link for the toolbar; an empty title is refused with native focus on the title field, its alert and no write; saving changes only that link text and href in the paragraph and in the packet; removing the link leaves the first link and the plain text untouched; Undo restores it',
        ],
      },
      {
        case: c(F.targetsComponent, 'existing link edits and unlink target the chosen adjacent link at 320px'),
        proves: [
          'the same click, edit and unlink chain keeps its target in the compact layout, where the drawer opens the editor and the plain text between and after the links is unchanged',
        ],
      },
      {
        case: c(F.targetsComponent, 'unlinked URL-shaped text loads and saves as plain text'),
        proves: [historicalLink],
      },
    ],
    retained: [
      {
        cases: [
          c(F.targets, 'unlink keeps URL-shaped text unlinked after saving and reloading'),
        ],
        reason: 'The real Worker save and reload prove the unlinked URL-shaped text is stored unlinked and read back unlinked; the component case only proves the packet and the load path.',
      },
    ],
  },
  {
    id: 'editor.links-background-change',
    legacy: [
      c(F.targets, 'background document changes keep link input but invalidate the captured target'),
    ],
    component: [
      {
        case: c(F.targetsComponent, 'background document changes keep link input but invalidate the captured target'),
        proves: [historicalLink],
      },
    ],
    retained: [],
  },
  {
    id: 'editor.links-delayed-close',
    legacy: [
      c(F.lifecycle, 'a delayed drawer link close leaves the destination input alone'),
      c(F.lifecycle, 'an old link dialog close cannot take focus from the reopened editor'),
      c(F.lifecycle, 'a delayed dialog link close leaves the destination input alone'),
    ],
    component: [
      {
        case: c(F.focus, 'an old link dialog close cannot take focus from the reopened editor'),
        proves: [
          'releasing the held close proves native focus delivery only; the DOM successor owns the reopened destination input and its typed value',
          'cancelling the reopened dialog returns native focus to the body',
        ],
      },
      {
        case: c(F.focus, 'a delayed formatting drawer close leaves the reopened link dialog alone at 390px'),
        proves: [
          'releasing the held drawer close opens exactly one link editor focused on its destination, and the typed destination saved from it links exactly the captured range with its neighbours unchanged',
        ],
      },
    ],
    retained: [
      {
        cases: [
          c(F.lifecycle, 'a delayed dialog link close leaves the destination input alone'),
        ],
        reason: 'Only the routed application changes the page under a pending overlay close; the case navigates to the tags form and proves the released close cannot take focus from that page input.',
      },
    ],
  },
  {
    id: 'editor.links-published-reader',
    legacy: [],
    component: [],
    retained: [
      {
        cases: [
          c(F.extraEntry, 'a relative link keeps its destination in the published reader'),
        ],
        reason: 'Publishing a real document and reading the public page is the Worker and SSR path: it proves a relative destination is stored, rendered into the page HTML and keeps its href in the reader.',
      },
    ],
  },
]
