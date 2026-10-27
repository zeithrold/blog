/* eslint-disable style/max-len, max-lines -- The flat migration table keeps every link legacy key and DOM successor together. */
import type { DomMigrationRecord } from './dom-migrations'

const sourceValidation = 'tests/browser/editor/links/link-validation.spec.ts'
const sourceNormalization = 'tests/browser/editor/links/link-normalization.spec.ts'
const links = 'tests/components/specs/editor-links.spec.ts'
const entry = 'tests/components/specs/editor-link-remaining-entry.spec.ts'
const focus = 'tests/components/specs/editor-link-remaining-focus.spec.ts'
const keyboard = 'tests/components/specs/editor-link-remaining-keyboard.spec.ts'
const targets = 'tests/components/specs/editor-link-remaining-targets.spec.ts'
const entryDom = 'tests/dom/link-entry.test.tsx'
const shortcutsDom = 'tests/dom/link-shortcuts.test.tsx'
const overlaysDom = 'tests/dom/link-overlays.test.tsx'
const targetsDom = 'tests/dom/link-targets.test.tsx'

function at(file: string, title: string): string {
  return `${file} :: ${title}`
}

/** Link UI and target outcomes belong to the real editor in jsdom; native residuals stay named. */
export const linkDomMigrations: readonly DomMigrationRecord[] = [
  {
    id: 'editor.links',
    legacy: [
      at(sourceValidation, 'link entry rejects invalid addresses before changing the draft at 1440px'),
      at(sourceValidation, 'link entry rejects invalid addresses before changing the draft at 390px'),
      at(sourceNormalization, 'toolbar links validate and normalize destinations at 1440px in en'),
      at(sourceNormalization, 'keyboard links validate and normalize destinations at 320px in zh'),
      at(sourceNormalization, 'toolbar links validate and normalize destinations at 320px in zh'),
      at(sourceNormalization, 'links validate and normalize destinations at 1440px in en'),
      at(links, 'the desktop shortcut opens one link editor focused on its destination'),
      at(links, 'the compact formatting drawer reaches the same link entry at 390px'),
      at(links, 'keyboard invalid destinations are refused at 1440px in en'),
      at(links, 'keyboard invalid destinations are refused at 320px in zh'),
      at(links, 'toolbar invalid destinations are refused at 320px in zh'),
      at(links, 'toolbar invalid destinations are refused at 390px in en'),
      at(links, 'keyboard destinations normalize and undo restores the range at 1440px in en'),
      at(links, 'keyboard destinations normalize and undo restores the range at 320px in zh'),
      at(links, 'toolbar destinations normalize and undo restores the range at 320px in zh'),
      at(links, 'toolbar destinations normalize and undo restores the range at 390px in en'),
    ],
    dom: [
      {
        case: at(entryDom, 'the desktop shortcut reuses one dialog and Cancel leaves the revision unchanged'),
        proves: [
          'the production Control+K path renders one Create link dialog, reuses it on a repeated shortcut, and Cancel sends no revision',
        ],
      },
      {
        case: at(entryDom, 'the compact formatting drawer hands its selection to the link dialog and saves the request'),
        proves: [
          'the real compact formatting drawer opens the link dialog for the selected range',
          'saving the selected relative destination renders its href and sends the exact inline content through the revision client',
        ],
      },
      {
        case: at(entryDom, 'keyboard refuses invalid destinations without a revision at 1440px in en'),
        proves: [
          'empty, spaced, ftp, protocol-relative, credential-bearing and over-long URLs show invalid state and English error copy',
          'every refusal leaves the body unlinked and sends no revision request',
        ],
      },
      {
        case: at(entryDom, 'toolbar refuses invalid destinations without a revision at 390px in en'),
        proves: [
          'the compact English drawer rejects all six unsafe destination forms with invalid field and alert state',
          'every refusal leaves the body unlinked and sends no revision request',
        ],
      },
      {
        case: at(entryDom, 'keyboard refuses invalid destinations without a revision at 320px in zh'),
        proves: [
          'the Chinese keyboard command rejects all six unsafe destination forms with localized error state',
          'every refusal leaves the body unlinked and sends no revision request',
        ],
      },
      {
        case: at(entryDom, 'toolbar refuses invalid destinations without a revision at 320px in zh'),
        proves: [
          'the compact Chinese drawer rejects all six unsafe destination forms with localized error state',
          'every refusal leaves the body unlinked and sends no revision request',
        ],
      },
      {
        case: at(entryDom, 'keyboard normalizes destinations and Undo restores the range at 1440px in en'),
        proves: [
          'site-relative, upper-case scheme, bare host and fragment input normalize to their literal expected hrefs',
          'each normalized link reaches the real revision packet and Undo restores the selected plain text',
        ],
      },
      {
        case: at(entryDom, 'toolbar normalizes destinations and Undo restores the range at 390px in en'),
        proves: [
          'the compact English drawer normalizes all four destination forms to their literal expected hrefs',
          'each normalized link reaches the real revision packet and Undo restores the selected plain text',
        ],
      },
      {
        case: at(entryDom, 'keyboard normalizes destinations and Undo restores the range at 320px in zh'),
        proves: [
          'the Chinese keyboard command normalizes all four destination forms to their literal expected hrefs',
          'each normalized link reaches the real revision packet and Undo restores the selected plain text',
        ],
      },
      {
        case: at(entryDom, 'toolbar normalizes destinations and Undo restores the range at 320px in zh'),
        proves: [
          'the compact Chinese drawer normalizes all four destination forms to their literal expected hrefs',
          'each normalized link reaches the real revision packet and Undo restores the selected plain text',
        ],
      },
    ],
    retained: [
      {
        cases: [
          at(sourceNormalization, 'links validate and normalize destinations at 1440px in en'),
        ],
        reason: 'The real Worker save, stored revision, reload and Undo preserve the normalized destination; jsdom proves the client request but not persistence.',
      },
      {
        cases: [
          at(links, 'the desktop shortcut opens one link editor focused on its destination'),
        ],
        reason: 'The historical title remains registered, but its UI assertions now live in the DOM successors; this browser residual keeps native selection creation and focus delivery into and out of the link dialog.',
      },
      {
        cases: [
          at(links, 'the compact formatting drawer reaches the same link entry at 390px'),
        ],
        reason: 'The historical title remains registered, but the DOM successor proves the drawer-to-dialog path; this browser residual keeps native selection creation and focus delivery through the compact handoff.',
      },
      {
        cases: [
          at(links, 'keyboard invalid destinations are refused at 1440px in en'),
        ],
        reason: 'The historical title remains registered but no longer describes the narrowed residual: it now keeps only native URL-field focus delivery after invalid submissions; DOM proves refusal and no-write behavior.',
      },
    ],
  },
  {
    id: 'editor.links-shortcut',
    legacy: [
      at(keyboard, 'Control+K and Meta+K open, cancel, save and Undo at 320px in en'),
      at(keyboard, 'Control+K and Meta+K open, cancel, save and Undo at 320px in zh'),
      at(keyboard, 'Control+K and Meta+K open, cancel, save and Undo at 390px in en'),
      at(keyboard, 'Control+K and Meta+K open, cancel, save and Undo at 390px in zh'),
      at(keyboard, 'Control+K and Meta+K open, cancel, save and Undo at 1440px in en'),
      at(keyboard, 'Control+K and Meta+K open, cancel, save and Undo at 1440px in zh'),
    ],
    dom: [
      {
        case: at(shortcutsDom, 'Control+K and Meta+K open, cancel, save and Undo at 320px in en'),
        proves: [
          'both modifiers cancel and Escape the real link dialog without a write',
          'clicking Save with either modifier commits the selected range into the exact revision packet and Undo returns it to plain text',
        ],
      },
      {
        case: at(shortcutsDom, 'Control+K and Meta+K open, cancel, save and Undo at 320px in zh'),
        proves: [
          'both modifiers route the Chinese keyboard command to the real link dialog',
          'clicking Save with either modifier commits the selected range into the exact revision packet and Undo returns it to plain text',
        ],
      },
      {
        case: at(shortcutsDom, 'Control+K and Meta+K open, cancel, save and Undo at 390px in en'),
        proves: [
          'both modifiers cancel and Escape the real link dialog without a write',
          'clicking Save with either modifier commits the selected range into the exact revision packet and Undo returns it to plain text',
        ],
      },
      {
        case: at(shortcutsDom, 'Control+K and Meta+K open, cancel, save and Undo at 390px in zh'),
        proves: [
          'both modifiers route the Chinese keyboard command to the real link dialog',
          'clicking Save with either modifier commits the selected range into the exact revision packet and Undo returns it to plain text',
        ],
      },
      {
        case: at(shortcutsDom, 'Control+K and Meta+K open, cancel, save and Undo at 1440px in en'),
        proves: [
          'both modifiers cancel and Escape the real link dialog without a write',
          'clicking Save with either modifier commits the selected range into the exact revision packet and Undo returns it to plain text',
        ],
      },
      {
        case: at(shortcutsDom, 'Control+K and Meta+K open, cancel, save and Undo at 1440px in zh'),
        proves: [
          'both modifiers route the Chinese keyboard command to the real link dialog',
          'clicking Save with either modifier commits the selected range into the exact revision packet and Undo returns it to plain text',
        ],
      },
    ],
    retained: [
      {
        cases: [
          at(keyboard, 'Control+K and Meta+K open, cancel, save and Undo at 320px in en'),
          at(keyboard, 'Control+K and Meta+K open, cancel, save and Undo at 390px in en'),
          at(keyboard, 'Control+K and Meta+K open, cancel, save and Undo at 390px in zh'),
          at(keyboard, 'Control+K and Meta+K open, cancel, save and Undo at 1440px in zh'),
        ],
        reason: 'The historical titles remain registered but no longer describe the narrowed residual: these four keys keep browser-created selection, native URL/body focus after Cancel and Escape, and measured containment; the DOM cases prove click-Save and Undo.',
      },
      {
        cases: [
          at(keyboard, 'Control+K and Meta+K open, cancel, save and Undo at 1440px in en'),
          at(keyboard, 'Control+K and Meta+K open, cancel, save and Undo at 320px in zh'),
        ],
        reason: 'The historical titles remain registered: these two representatives keep browser-created selection, native focus and containment, both modifiers’ Cancel/Escape paths, and real URL-field Enter submission through the exact packet and Undo; the DOM cases prove the separate click-Save path.',
      },
    ],
  },
  {
    id: 'editor.links-shortcut-guards',
    legacy: [
      at(keyboard, 'empty and composing selections suppress the shortcut at 1440px in en'),
      at(keyboard, 'empty and composing selections suppress the shortcut at 390px in en'),
      at(keyboard, 'empty and composing selections suppress the shortcut at 320px in zh'),
    ],
    dom: [
      {
        case: at(shortcutsDom, 'empty and composing selections suppress both link shortcuts at 1440px in en'),
        proves: [
          'a collapsed ProseMirror selection suppresses both Control+K and Meta+K',
          'a composing selection suppresses both modifiers and leaves text and revision requests unchanged',
        ],
      },
      {
        case: at(shortcutsDom, 'empty and composing selections suppress both link shortcuts at 390px in en'),
        proves: [
          'a collapsed ProseMirror selection suppresses both Control+K and Meta+K at the compact host width',
          'a composing selection suppresses both modifiers and leaves text and revision requests unchanged',
        ],
      },
      {
        case: at(shortcutsDom, 'empty and composing selections suppress both link shortcuts at 320px in zh'),
        proves: [
          'a collapsed ProseMirror selection suppresses both Control+K and Meta+K in Chinese',
          'a composing selection suppresses both modifiers and leaves text and revision requests unchanged',
        ],
      },
    ],
    retained: [
      {
        cases: [
          at(keyboard, 'empty and composing selections suppress the shortcut at 1440px in en'),
        ],
        reason: 'Both engines retain real ArrowRight collapse and real Control+K/Meta+K cancellation without mutation. They also retain a confirmed non-empty DOM/model range with fixture composition lifecycle and native shortcut delivery; this proves the application guard, not real operating-system IME.',
      },
      {
        cases: [
          at(keyboard, 'empty and composing selections suppress the shortcut at 320px in zh'),
        ],
        reason: 'This historical key retains collapsed-caret native default cancellation and a non-empty composing range with fixture lifecycle plus native shortcuts in both engines. The 390px key uses the same compact controller branch; operating-system IME remains outside this claim.',
      },
    ],
  },
  {
    id: 'editor.links-destination',
    legacy: [
      at(keyboard, 'a corrected bare domain saves after refusals at 390px in zh'),
    ],
    dom: [
      {
        case: at(entryDom, 'a corrected bare domain saves after refusals at 390px in zh'),
        proves: [
          'empty and spaced invalid URLs stay in the Chinese dialog and produce no revision',
          'correcting the field to example.com saves https://example.com on the selected range in the revision packet',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'editor.links-busy',
    legacy: [
      at(entry, 'a held publication makes the compact editor read-only and rejects link shortcuts'),
    ],
    dom: [
      {
        case: at(overlaysDom, 'a held Publish request makes the real editor read-only and suppresses link shortcuts'),
        proves: [
          'the real Publish action keeps BlockNote read-only while its HTTP reply is held',
          'a confirmed non-empty DOM and ProseMirror selection stays unlinked with no revision while both modifiers are suppressed',
          'the failing held reply restores the original body and a valid selection can reopen the link dialog after release',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'editor.links-touch-entry',
    legacy: [
      at(entry, 'the mobile formatting drawer hands a touch selection to the link dialog in dark zh'),
    ],
    dom: [
      {
        case: at(overlaysDom, 'the compact dark Chinese drawer opens and saves a localized link dialog'),
        proves: [
          'the real compact Chinese drawer opens the dark-mode link dialog with localized field and Save copy',
          'the selected destination reaches the real revision packet',
        ],
      },
    ],
    retained: [
      {
        cases: [
          at(entry, 'the mobile formatting drawer hands a touch selection to the link dialog in dark zh'),
        ],
        reason: 'The historical title remains registered: this touch case keeps native range creation, drawer-to-dialog URL focus, Save, dialog close and body-focus delivery, while proving only the selected range reaches the packet; Axe still scans the real computed styles and accessibility tree.',
      },
    ],
  },
  {
    id: 'editor.links-selections',
    legacy: [
      at(targets, 'linking partial, following and crossing selections preserves all other characters and styles at 1440px'),
      at(targets, 'linking a mobile partial link preserves all other characters and styles at 320px'),
    ],
    dom: [
      {
        case: at(targetsDom, 'linking partial, following and crossing selections preserves the other characters and styles'),
        proves: [
          'four actual BlockNote ranges link only the selected graphemes and preserve every unselected href and style in the revision packet',
          'Undo restores the original adjacent links and plain text',
        ],
      },
      {
        case: at(targetsDom, 'linking the compact partial-link selection preserves its neighbouring content'),
        proves: [
          'the compact actual BlockNote range links only the selected graphemes and preserves neighbouring hrefs and text styles in the packet',
        ],
      },
    ],
    retained: [
      {
        cases: [
          at(targets, 'linking partial, following and crossing selections preserves all other characters and styles at 1440px'),
        ],
        reason: 'The historical title remains registered: four native ranges inside, after and across adjacent links drive Meta+K and Save; each result changes only the selected graphemes in the editor and exact packet, preserves text/styles/neighbouring links, and Undo restores the original packet.',
      },
      {
        cases: [
          at(targets, 'linking a mobile partial link preserves all other characters and styles at 320px'),
        ],
        reason: 'The historical title remains registered: the native partial-link range drives the compact drawer and Save; only the selected graphemes change href in the editor and exact packet, neighbouring content stays intact, and Undo restores the original packet.',
      },
    ],
  },
  {
    id: 'editor.links-edit-unlink',
    legacy: [
      at(targets, 'existing link edits and unlink target the chosen adjacent link at 1440px'),
      at(targets, 'existing link edits and unlink target the chosen adjacent link at 320px'),
      at(targets, 'unlinked URL-shaped text loads and saves as plain text'),
    ],
    dom: [
      {
        case: at(targetsDom, 'existing link edits and unlink target only the chosen adjacent link at 1440px'),
        proves: [
          'the real link toolbar edits only Beta, refuses an empty display label and sends the expected adjacent-link content',
          'Remove link unlinks only the edited target and Undo restores its href through the real revision client',
        ],
      },
      {
        case: at(targetsDom, 'existing link edits and unlink target only the chosen adjacent link at 320px'),
        proves: [
          'the compact real link toolbar edits only Beta and refuses an empty display label',
          'Remove link unlinks only the edited target and the exact packet preserves its neighbour',
        ],
      },
      {
        case: at(targetsDom, 'stored URL-shaped text remains unlinked after the real editor loads and saves it'),
        proves: [
          'the real BlockNote editor loads URL-shaped plain text without an anchor',
          'an edit before it leaves the URL text unlinked in the revision request',
        ],
      },
    ],
    retained: [
      {
        cases: [
          at(targets, 'existing link edits and unlink target the chosen adjacent link at 1440px'),
          at(targets, 'existing link edits and unlink target the chosen adjacent link at 320px'),
        ],
        reason: 'Both historical keys remain registered because native click targeting and focus differ from the DOM proof: each clicks Beta, refuses an empty title with native title focus and no write, saves only the captured link with an exact packet, removes only that link, then Undo restores it.',
      },
    ],
  },
  {
    id: 'editor.links-background-change',
    legacy: [
      at(targets, 'background document changes keep link input but invalidate the captured target'),
    ],
    dom: [
      {
        case: at(targetsDom, 'a background document change keeps the typed URL and disables its captured target'),
        proves: [
          'a real BlockNote transaction behind the dialog keeps the typed URL and announces that the captured document changed',
          'Save stays disabled and Enter cannot close the dialog or create an anchor',
          'Cancel persists the changed plain-text document through the real Client/fetch boundary',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'editor.links-delayed-close',
    legacy: [
      at(focus, 'an old link dialog close cannot take focus from the reopened editor'),
      at(focus, 'a delayed formatting drawer close leaves the reopened link dialog alone at 390px'),
    ],
    dom: [
      {
        case: at(overlaysDom, 'the delayed dialog close cannot replace the reopened editor state'),
        proves: [
          'a deferred old dialog close leaves the reopened link dialog and its input value intact',
          'the reopened dialog can be cancelled without a revision write',
        ],
      },
      {
        case: at(overlaysDom, 'the delayed compact drawer close waits before handing its range to one link editor'),
        proves: [
          'the compact link action waits for the real drawer close before rendering its one link dialog',
          'the selected link saves after the deferred handoff in the real revision packet',
        ],
      },
    ],
    retained: [
      {
        cases: [
          at(focus, 'an old link dialog close cannot take focus from the reopened editor'),
        ],
        reason: 'This native residual proves focus delivery only across delayed FocusScope cleanup; its DOM successor owns the reopened input’s typed value and no-write cancellation.',
      },
      {
        cases: [
          at(focus, 'a delayed formatting drawer close leaves the reopened link dialog alone at 390px'),
        ],
        reason: 'The historical title remains registered: after the delayed drawer close releases, this browser case saves to the captured range, closes the dialog, restores body focus, preserves neighbouring text, and proves the selected href in the exact packet.',
      },
    ],
  },
]
