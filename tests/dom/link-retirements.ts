/* eslint-disable style/max-len -- Exact case references and assertion reasons stay on one line. */
/**
 * Native link cases retained after their component-level assertions move to jsdom.
 *
 * The historical title remains the registration key. `moved` names assertions
 * that a real DOM successor now owns; `remainsNative` is limited to facts the
 * browser supplies and gives every remaining assertion its own reason.
 */
export type LinkNativeAssertion = {
  readonly assertion: string
  readonly reason: string
}

export type LinkRetirement = {
  readonly playwright: string
  readonly dom: readonly string[]
  readonly moved: readonly string[]
  readonly remainsNative: readonly LinkNativeAssertion[]
}

const editorLinks = 'tests/components/specs/editor-links.spec.ts'
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

export const linkRetirements: readonly LinkRetirement[] = [
  {
    playwright: at(editorLinks, 'the desktop shortcut opens one link editor focused on its destination'),
    dom: [
      at(entryDom, 'the desktop shortcut reuses one dialog and Cancel leaves the revision unchanged'),
      at(shortcutsDom, 'Control+K and Meta+K open, cancel, save and Undo at 1440px in en'),
    ],
    moved: [
      'the real ControlOrMeta shortcut opens exactly one Create link dialog and a repeated shortcut does not stack another dialog',
      'Cancel closes the dialog without a revision write',
    ],
    remainsNative: [
      {
        assertion: 'a browser-created range selects exactly "Selected link" before the shortcut opens',
        reason: 'jsdom selection APIs do not establish native browser range creation or its synchronization to the editable surface.',
      },
      {
        assertion: 'the URL input receives native focus after the shortcut opens',
        reason: 'active-element delivery after opening a Radix dialog is browser focus behavior.',
      },
      {
        assertion: 'Cancel returns native focus to the editor body',
        reason: 'focus restoration from the closing dialog depends on native browser focus delivery.',
      },
    ],
  },
  {
    playwright: at(editorLinks, 'the compact formatting drawer reaches the same link entry at 390px'),
    dom: [
      at(entryDom, 'the compact formatting drawer hands its selection to the link dialog and saves the request'),
    ],
    moved: [
      'the compact More formatting options drawer exposes the real Create link action',
      'the action saves the selected destination and the revision packet carries the selected range',
    ],
    remainsNative: [
      {
        assertion: 'a browser-created range selects exactly "Selected link" before compact toolbar entry',
        reason: 'jsdom selection APIs do not establish native browser range creation or its synchronization to the editable surface.',
      },
      {
        assertion: 'the destination input receives native focus after the compact drawer hands off',
        reason: 'focus delivery through the closing drawer and opening dialog is browser focus behavior.',
      },
    ],
  },
  {
    playwright: at(editorLinks, 'keyboard invalid destinations are refused at 1440px in en'),
    dom: [
      at(entryDom, 'keyboard refuses invalid destinations without a revision at 1440px in en'),
      at(entryDom, 'toolbar refuses invalid destinations without a revision at 390px in en'),
      at(entryDom, 'keyboard refuses invalid destinations without a revision at 320px in zh'),
      at(entryDom, 'toolbar refuses invalid destinations without a revision at 320px in zh'),
    ],
    moved: [
      'empty, spaced, ftp, protocol-relative, credential-bearing and over-long destinations remain invalid and show localized copy',
      'invalid destinations leave the body unlinked and send no revision request',
    ],
    remainsNative: [
      {
        assertion: 'the browser delivers focus to the URL field after each of the six invalid submissions',
        reason: 'native active-element delivery after form rejection is not established by jsdom.',
      },
    ],
  },
  {
    playwright: at(entry, 'the mobile formatting drawer hands a touch selection to the link dialog in dark zh'),
    dom: [
      at(overlaysDom, 'the compact dark Chinese drawer opens and saves a localized link dialog'),
    ],
    moved: [
      'the real compact drawer and Chinese dark link dialog render with the localized URL and Save controls',
      'saving the selected destination sends the expected revision packet',
    ],
    remainsNative: [
      {
        assertion: 'touch Save links exactly the native selection, keeps neighbouring text unchanged and returns focus to the body',
        reason: 'jsdom selection APIs do not establish browser range handoff through a touch-driven drawer and dialog, or native focus restoration after Save.',
      },
      {
        assertion: 'the dark Chinese link dialog has no axe violations',
        reason: 'the axe scan over real computed styles and the browser accessibility tree cannot be reproduced in jsdom.',
      },
    ],
  },
  {
    playwright: at(focus, 'an old link dialog close cannot take focus from the reopened editor'),
    dom: [
      at(overlaysDom, 'the delayed dialog close cannot replace the reopened editor state'),
    ],
    moved: [
      'the deferred close leaves the reopened dialog and its typed value in place',
      'the reopened dialog can be cancelled without a revision write',
    ],
    remainsNative: [
      {
        assertion: 'releasing the old close leaves native focus on the reopened URL input',
        reason: 'native focus delivery across competing FocusScope cleanup events requires a browser.',
      },
      {
        assertion: 'cancelling the reopened dialog returns native focus to the editor body',
        reason: 'focus restoration from the closing dialog is browser focus behavior.',
      },
    ],
  },
  {
    playwright: at(focus, 'a delayed formatting drawer close leaves the reopened link dialog alone at 390px'),
    dom: [
      at(overlaysDom, 'the delayed compact drawer close waits before handing its range to one link editor'),
    ],
    moved: [
      'the link entry waits for the real compact drawer close before opening its single dialog',
      'saving after the handoff sends the selected destination in the revision packet',
    ],
    remainsNative: [
      {
        assertion: 'the URL input receives native focus when the delayed drawer close is released',
        reason: 'native focus delivery across the drawer FocusScope close requires a browser.',
      },
      {
        assertion: 'saving after release closes the dialog, returns focus to the body, and links only the captured phrase',
        reason: 'focus restoration and the browser-created range handoff across the drawer FocusScope close require a browser.',
      },
    ],
  },
  ...[
    { width: 320, locale: 'en' },
    { width: 320, locale: 'zh' },
    { width: 390, locale: 'en' },
    { width: 390, locale: 'zh' },
    { width: 1440, locale: 'en' },
    { width: 1440, locale: 'zh' },
  ].map(({ width, locale }): LinkRetirement => ({
    playwright: at(keyboard, `Control+K and Meta+K open, cancel, save and Undo at ${width}px in ${locale}`),
    dom: [
      at(shortcutsDom, `Control+K and Meta+K open, cancel, save and Undo at ${width}px in ${locale}`),
    ],
    moved: [
      'Control+K and Meta+K open the real dialog without stacking another instance',
      'Cancel and Escape close the real dialog without issuing a revision request',
      'The DOM Save-button path commits the normalized destination and selected range to the exact packet; synthetic Enter keydown in jsdom exercises at most the dialog handler and does not perform implicit form submission, which native representatives prove',
      'Undo removes the link from both the rendered body and the next revision packet',
    ],
    remainsNative: [
      {
        assertion: 'the browser-created range selects "Selected link" before either modifier opens the dialog',
        reason: 'native range creation and synchronization to the editable surface are browser behavior.',
      },
      {
        assertion: 'opening delivers focus to the URL input and Cancel/Escape return it to the editor body',
        reason: 'native focus delivery and restoration across the dialog are browser behavior.',
      },
      {
        assertion: 'the open link dialog stays inside the measured viewport at the registered width',
        reason: 'dialog containment requires painted browser geometry unavailable to jsdom.',
      },
      ...((width === 1440 && locale === 'en') || (width === 320 && locale === 'zh')
        ? [
            {
              assertion: 'pressing real Enter in the URL field submits the link form and saves its exact packet',
              reason: 'implicit form submission is a browser default action; a synthetic jsdom Enter keydown does not perform it.',
            },
          ]
        : []),
    ],
  })),
  {
    playwright: at(targets, 'linking partial, following and crossing selections preserves all other characters and styles at 1440px'),
    dom: [
      at(targetsDom, 'linking partial, following and crossing selections preserves the other characters and styles'),
    ],
    moved: [
      'the real link editor changes only selected graphemes and preserves every other href and bold/italic style in the revision packet',
      'Undo restores the original adjacent links and plain text',
    ],
    remainsNative: [
      {
        assertion: 'the native ranges "lp", "Plain", "B" and "haBe" drive real link saves that change only their selected characters, preserve neighbors, and Undo',
        reason: 'native range boundary mapping through a real editor transaction across inline marks and plain text is browser behavior.',
      },
    ],
  },
  {
    playwright: at(targets, 'linking a mobile partial link preserves all other characters and styles at 320px'),
    dom: [
      at(targetsDom, 'linking the compact partial-link selection preserves its neighbouring content'),
    ],
    moved: [
      'the real compact link editor changes only the selected graphemes and preserves surrounding hrefs and text styles in the revision packet',
    ],
    remainsNative: [
      {
        assertion: 'the native "lp" range drives the compact drawer save, changes only that href, and preserves neighbors',
        reason: 'native range boundary mapping through the compact drawer into the real editor transaction is browser behavior.',
      },
    ],
  },
  {
    playwright: at(keyboard, 'empty and composing selections suppress the shortcut at 1440px in en'),
    dom: [
      at(shortcutsDom, 'empty and composing selections suppress both link shortcuts at 1440px in en'),
    ],
    moved: [
      'the controller suppresses shortcut commands for an empty selection and a composing selection without a link write',
    ],
    remainsNative: [
      {
        assertion: 'after real ArrowRight, the editor cancels real Control+K and Meta+K with caret and text unchanged and no dialog or write',
        reason: 'only a browser press can expose the platform default action and its native editor effects.',
      },
      {
        assertion: 'a confirmed non-empty DOM and model range survives fixture composition lifecycle and both real shortcut presses without a dialog or write',
        reason: 'native shortcut default cancellation is proved on both engines; fixture composition signals application state, not operating-system IME.',
      },
    ],
  },
  {
    playwright: at(keyboard, 'empty and composing selections suppress the shortcut at 320px in zh'),
    dom: [
      at(shortcutsDom, 'empty and composing selections suppress both link shortcuts at 320px in zh'),
    ],
    moved: [
      'the Chinese compact controller suppresses shortcut commands for an empty selection and a composing selection without a link write',
    ],
    remainsNative: [
      {
        assertion: 'after real ArrowRight, the editor cancels real Control+K and Meta+K with caret and text unchanged and no dialog or write',
        reason: 'only a browser press can expose the platform default action and its native editor effects; the retired 390px key used this same compact controller branch.',
      },
      {
        assertion: 'a confirmed non-empty DOM and model range survives fixture composition lifecycle and both real shortcut presses without a dialog or write',
        reason: 'the compact controller application guard needs native shortcut delivery as well as the declared composition lifecycle; this does not prove operating-system IME.',
      },
    ],
  },
  {
    playwright: at(entry, 'a held publication makes the compact editor read-only and rejects link shortcuts'),
    dom: [
      at(overlaysDom, 'a held Publish request makes the real editor read-only and suppresses link shortcuts'),
    ],
    moved: [
      'a confirmed non-empty DOM and model selection stays unlinked with no revision while both modifiers are suppressed during a held Publish request',
      'the failed reply restores the original body and a valid selection reopens the dialog after release',
    ],
    remainsNative: [],
  },
  ...[1440, 320].map((width): LinkRetirement => ({
    playwright: at(targets, `existing link edits and unlink target the chosen adjacent link at ${width}px`),
    dom: [
      at(targetsDom, `existing link edits and unlink target only the chosen adjacent link at ${width}px`),
    ],
    moved: [
      'the real link toolbar refuses an empty title without writing, then edits and removes only Beta in the exact revision packet',
      'Undo restores the edited link and adjacent content remains unchanged',
    ],
    remainsNative: [
      {
        assertion: 'a real click on Beta captures its neighbouring link as the Edit and Remove target, with native title focus on refusal',
        reason: 'the browser hit target and focus delivery are not established by the DOM-side model selection.',
      },
    ],
  })),
]
