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

// Both product modifiers per retired pair become one round that presses each of them.
const shortcutRounds = [
  320,
  390,
  1440,
].flatMap(width => ['en', 'zh'].map(locale => ({
  case: c(F.shortcut, `Control+K and Meta+K open, cancel, save and Undo at ${width}px in ${locale}`),
  proves: [
    'each modifier opens exactly one Create link editor with its destination focused and inside the viewport',
    'cancel and Escape close it, restore the captured range to the body and write nothing',
    `Enter saves the destination into the revision packet and the selection's anchor carries the href (${locale})`,
    'Undo removes the link from both the body and the next packet',
  ],
})))

const shortcutPairs = [320, 390].flatMap(width => ['en', 'zh'].flatMap(locale => [
  'Control',
  'Meta',
].map(modifier => c(F.keyboard, `closed options allow ${modifier}+K at ${width}px in ${locale} with cancel, save and Undo`))))

const suppressedSelections = [
  { width: 1440, locale: 'en' },
  { width: 390, locale: 'en' },
  { width: 320, locale: 'zh' },
].map(({ width, locale }) => ({
  case: c(F.shortcut, `empty and composing selections suppress the shortcut at ${width}px in ${locale}`),
  proves: [
    'a collapsed caret rejects both modifiers without opening an editor',
    'a composing selection rejects both modifiers and keeps the paragraph text',
    'no revision packet leaves the client for either guard',
  ],
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
    component: suppressedSelections,
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
        proves: [
          'empty and spaced destinations keep the dialog open, focused and marked invalid in Chinese',
          'each refusal leaves no link in the body and sends no revision packet',
          'the corrected bare domain saves as https://example.com against the selected range',
        ],
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
        proves: [
          'a held publication makes the compact body read-only',
          'both modifiers are rejected while it is pending and no dialog appears',
          'releasing the reply restores editing and the paragraph text is unchanged',
        ],
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
          'a touch tap on More formatting options opens the Chinese drawer in dark mode',
          'the drawer hands the selection to the link dialog, closes itself and focuses the destination',
          'the dialog passes Axe and the saved destination reaches the revision packet',
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
          'each of the four desktop selection shapes links only its own graphemes in the revision packet',
          'every other character keeps its href and bold/italic style through the save',
          'Undo returns the adjacent links and plain text to their original characters',
        ],
      },
      {
        case: c(F.targetsComponent, 'linking a mobile partial link preserves all other characters and styles at 320px'),
        proves: [
          'the compact partial-link selection links only its own graphemes in the revision packet',
          'the surrounding link characters keep their href and the plain text keeps its style',
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
          'the clicked adjacent link opens its own edit dialog with its title and URL',
          'an empty title keeps the dialog open, focused and alerting without a revision packet',
          'the edit reaches the packet, the neighbouring link keeps its href, and Remove link unlinks only the edited link',
          'Undo restores the edited link href',
        ],
      },
      {
        case: c(F.targetsComponent, 'existing link edits and unlink target the chosen adjacent link at 320px'),
        proves: [
          'the clicked adjacent link opens its own edit dialog on the compact layout',
          'an empty title keeps the dialog open, focused and alerting without a revision packet',
          'the edit and the unlink reach the packet for the chosen link only',
        ],
      },
      {
        case: c(F.targetsComponent, 'unlinked URL-shaped text loads and saves as plain text'),
        proves: [
          'a stored document that keeps URL-shaped text as a text run loads without an anchor',
          'the next revision packet still carries that text as plain text',
        ],
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
        proves: [
          'a document change behind the dialog keeps the typed destination and its focus',
          'the dialog reports that the document changed and disables Save, and Enter cannot close it',
          'cancel writes the changed document and returns focus to the body',
        ],
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
          'a close that is still waiting keeps its count while the editor is reopened',
          'releasing it leaves the reopened destination focused with its typed value',
          'cancelling the reopened dialog returns focus to the body and writes nothing',
        ],
      },
      {
        case: c(F.focus, 'a delayed formatting drawer close leaves the reopened link dialog alone at 390px'),
        proves: [
          'the compact drawer hands its selection to the link entry and closes itself while its close waits',
          'the pending close keeps every dialog closed instead of opening a second surface',
          'releasing it opens that one focused editor and the save reaches the revision packet',
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
