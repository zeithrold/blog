/* eslint-disable max-lines -- One flat table maps every retired source case to its component cases. */
/* eslint-disable style/max-len -- Verbatim case references stay on one line. */
import type { AdminMigrationRecord } from './admin-migrations'

/**
 * Where the retired editor source browser cases now run.
 *
 * `legacy` names the E2E case that owned the assertion, `component` names the component browser
 * case that proves it on the production editor entry (real BlockNote, source blocks, draft
 * coordinator), and `proves` lists the assertions that case covers. A case stays in E2E when only
 * the built application can prove it: a paste that has to reach the Worker and survive a reload,
 * the publication lock that only the routed app puts the editor in, and the stored copy a delete
 * must leave untouched.
 *
 * The retired `rich clipboard … node selection false` pair shares one paste path: both kinds open
 * through the same `SourceBlockView` control and run the same capture-phase paste handler, so the
 * component case keeps one parameterised case per kind instead of two hand-split ones. The
 * retained `node selection true` pair still covers both kinds end to end with the Worker.
 */
// The link entry matrix the retired E2E ran: both entry points in English and in the 320px
// Chinese layout, so the localized validation text and the toolbar/drawer wiring stay covered.
const linkEntryMatrix = [
  { entry: 'keyboard', width: 1440, locale: 'en' },
  { entry: 'toolbar', width: 390, locale: 'en' },
  { entry: 'keyboard', width: 320, locale: 'zh' },
  { entry: 'toolbar', width: 320, locale: 'zh' },
].flatMap(({ entry, width, locale }) => [
  {
    case: c('tests/components/specs/editor-links.spec.ts', `${entry} invalid destinations are refused at ${width}px in ${locale}`),
    proves: [
      'empty, spaced, ftp, protocol-relative, credential-bearing and over-long destinations keep the editor open and focused',
      `each refusal marks the field invalid and shows the localized message (${locale}) without creating a link`,
      'no revision packet leaves the client for any refused destination',
    ],
  },
  {
    case: c('tests/components/specs/editor-links.spec.ts', `${entry} destinations normalize and undo restores the range at ${width}px in ${locale}`),
    proves: [
      'site-relative, upper-case scheme, bare host and fragment destinations normalize to the expected href',
      'each applied link lands in the revision packet against the selected range only',
      'undo removes the link from the range',
    ],
  },
])

export const sourceMigrations: readonly AdminMigrationRecord[] = [
  {
    id: 'editor.source-entry',
    legacy: [
      c('tests/browser/editor/source/source-entry.spec.ts', 'math Enter enters source text before the next Enter inserts a line'),
      c('tests/browser/editor/source/source-entry.spec.ts', 'mermaid Enter enters source text before the next Enter inserts a line'),
      c('tests/browser/editor/source/source-entry.spec.ts', 'math rich clipboard becomes source text with node selection false'),
      c('tests/browser/editor/source/source-entry.spec.ts', 'mermaid rich clipboard becomes source text with node selection false'),
      c('tests/browser/editor/source/source-entry.spec.ts', 'math rich clipboard becomes source text with node selection true'),
      c('tests/browser/editor/source/source-entry.spec.ts', 'mermaid rich clipboard becomes source text with node selection true'),
      c('tests/browser/editor/source/source-entry.spec.ts', 'math text insertion without keydown keeps its selected node'),
      c('tests/browser/editor/source/source-entry.spec.ts', 'mermaid text insertion without keydown keeps its selected node'),
      c('tests/browser/editor/source/source-entry.spec.ts', 'math composition starts inside source and keeps its range'),
      c('tests/browser/editor/source/source-entry.spec.ts', 'mermaid composition starts inside source and keeps its range'),
      c('tests/browser/editor/source/source-entry.spec.ts', 'math beforeinput deletion and line breaks respect source boundaries'),
      c('tests/browser/editor/source/source-entry.spec.ts', 'mermaid beforeinput deletion and line breaks respect source boundaries'),
      c('tests/browser/editor/source/source-entry.spec.ts', 'reverse cross-block selection keeps Mod+A at document scope'),
      c('tests/browser/editor/source/source-entry.spec.ts', 'a lone source closes without hidden editing while publication locked false'),
      c('tests/browser/editor/source/source-entry.spec.ts', 'a lone source closes without hidden editing while publication locked true'),
    ],
    component: [
      {
        case: c('tests/components/specs/editor-source.spec.ts', 'math Enter enters source text before the next Enter inserts a line'),
        proves: [
          'Enter on a selected source opens it without inserting, and the caret is inside its text',
          'the next Enter inserts one line and typing q lands after it',
          'the revision packet carries the newline and undo keeps the block beside its paragraph',
        ],
      },
      {
        case: c('tests/components/specs/editor-source.spec.ts', 'mermaid Enter enters source text before the next Enter inserts a line'),
        proves: [
          'Enter on a selected diagram opens it without inserting, and the caret is inside its text',
          'the next Enter inserts one line and typing q lands after it',
          'the revision packet carries the newline and undo keeps the block beside its paragraph',
        ],
      },
      {
        case: c('tests/components/specs/editor-source.spec.ts', 'math rich clipboard becomes source text without creating a block'),
        proves: [
          'a rich clipboard payload opened from the Edit control keeps only its plain text',
          'the inserted lines become math source text on one block instead of creating paragraphs',
          'the revision packet carries the pasted source',
        ],
      },
      {
        case: c('tests/components/specs/editor-source.spec.ts', 'mermaid rich clipboard becomes source text without creating a block'),
        proves: [
          'a rich clipboard payload opened from the Edit control keeps only its plain text',
          'the inserted lines become diagram source text on one block instead of creating paragraphs',
          'the revision packet carries the pasted source',
        ],
      },
      {
        case: c('tests/components/specs/editor-source.spec.ts', 'math text insertion without keydown keeps its selected node'),
        proves: [
          'text inserted without a keydown stays inside the selected math source and reaches the revision packet',
        ],
      },
      {
        case: c('tests/components/specs/editor-source.spec.ts', 'mermaid text insertion without keydown keeps its selected node'),
        proves: [
          'text inserted without a keydown stays inside the selected diagram source and reaches the revision packet',
        ],
      },
      {
        case: c('tests/components/specs/editor-source.spec.ts', 'math composition starts inside source and keeps its range'),
        proves: [
          'compositionstart is not prevented and leaves the caret inside the math source',
          'an Enter reported while composing inserts nothing and the composed character reaches the revision packet',
        ],
      },
      {
        case: c('tests/components/specs/editor-source.spec.ts', 'mermaid composition starts inside source and keeps its range'),
        proves: [
          'compositionstart is not prevented and leaves the caret inside the diagram source',
          'an Enter reported while composing inserts nothing and the composed character reaches the revision packet',
        ],
      },
      {
        case: c('tests/components/specs/editor-source.spec.ts', 'math beforeinput deletion and line breaks respect source boundaries'),
        proves: [
          'forward deletion at the end of the math source is prevented and keeps its text',
          'insertParagraph is prevented and inserts exactly one line inside the source',
        ],
      },
      {
        case: c('tests/components/specs/editor-source.spec.ts', 'mermaid beforeinput deletion and line breaks respect source boundaries'),
        proves: [
          'forward deletion at the end of the diagram source is prevented and keeps its text',
          'insertParagraph is prevented and inserts exactly one line inside the source',
        ],
      },
      {
        case: c('tests/components/specs/editor-source.spec.ts', 'math paste into a node-selected source keeps its plain text'),
        proves: [
          'a rich clipboard payload on a node-selected math block keeps only its plain text',
          'the pasted lines stay on that block, the neighbour paragraph survives and the packet carries the text',
        ],
      },
      {
        case: c('tests/components/specs/editor-source.spec.ts', 'mermaid paste into a node-selected source keeps its plain text'),
        proves: [
          'a rich clipboard payload on a node-selected diagram block keeps only its plain text',
          'the pasted lines stay on that block, the neighbour paragraph survives and the packet carries the text',
        ],
      },
      {
        case: c('tests/components/specs/editor-source.spec.ts', 'a lone source closes without hidden editing while publication locked'),
        proves: [
          'a held publish request makes the body read-only while the source editor still opens and closes',
          'closing the editor while publish is held writes no revision and leaves the source text intact',
          'releasing the publish request restores editing',
        ],
      },
      {
        case: c('tests/components/specs/editor-source.spec.ts', 'reverse cross-block selection keeps Mod+A at document scope'),
        proves: [
          'a reverse selection from inside source text widens to the whole document on Mod+A and writes nothing',
        ],
      },
      {
        case: c('tests/components/specs/editor-source.spec.ts', 'a lone source closes without hidden editing'),
        proves: [
          'closing a lone source returns focus to the body instead of a hidden editor',
          'typing then creates the next paragraph while the source keeps its text',
        ],
      },
    ],
    // Nothing of this file stays in E2E: the paste path, the publication lock (a held publish
    // ack, not a route change) and every input rule are provable on the real editor entry.
    retained: [],
  },
  {
    id: 'editor.source-input',
    legacy: [
      c('tests/browser/editor/source/source-input.spec.ts', 'typing on a selected math preserves every character and the block'),
      c('tests/browser/editor/source/source-input.spec.ts', 'typing on a selected mermaid preserves every character and the block'),
      c('tests/browser/editor/source/source-input.spec.ts', 'Delete at the end of mermaid source preserves the following paragraph'),
    ],
    component: [
      {
        case: c('tests/components/specs/editor-source.spec.ts', 'math Delete at the end of its source keeps the following paragraph'),
        proves: [
          'Delete at the end of the math source leaves the text and the following paragraph untouched',
          'the client sends no revision packet, so the bound is proved before storage',
        ],
      },
      {
        case: c('tests/components/specs/editor-source.spec.ts', 'mermaid Delete at the end of its source keeps the following paragraph'),
        proves: [
          'Delete at the end of the diagram source leaves the text and the following paragraph untouched',
          'the client sends no revision packet',
        ],
      },
      {
        case: c('tests/components/specs/editor-source.spec.ts', 'math typing on a selected source preserves every character and the block'),
        proves: [
          'typing on a selected source opens it and keeps every typed character',
          'the block and its neighbouring paragraph survive, and the revision packet carries the text',
        ],
      },
      {
        case: c('tests/components/specs/editor-source.spec.ts', 'mermaid typing on a selected source preserves every character and the block'),
        proves: [
          'typing on a selected diagram opens it and keeps every typed character',
          'the block and its neighbouring paragraph survive, and the revision packet carries the text',
        ],
      },
    ],
    retained: [
      {
        cases: [
          c('tests/browser/editor/source/source-input.spec.ts', 'Delete at the end of a math source preserves the following paragraph'),
        ],
        reason: 'The single source persistence representative: it reads the stored document to prove the delete reached the Worker without removing a block.',
      },
    ],
  },
  {
    id: 'editor.code-language',
    legacy: [
      c('tests/browser/editor/source/code-language.spec.ts', 'code highlighting updates live without changing native input history or source at 1440px'),
      c('tests/browser/editor/source/code-language.spec.ts', 'code highlighting updates live without changing native input history or source at 390px'),
    ],
    component: [
      {
        case: c('tests/components/specs/editor-code-language.spec.ts', 'code highlighting paints native tokens and follows the editor color mode'),
        proves: [
          'a python block paints more than two token colours and the def keyword resolves to one span',
          'the Appearance menu repaints that token for dark mode and restores the light colour',
          'the code element stays connected while the highlighter repaints it',
        ],
      },
      {
        case: c('tests/components/specs/editor-code-language.spec.ts', 'native undo and redo keep the highlighted code source'),
        proves: [
          'the caret lands at the end of the source and the inserted comment becomes its own token',
          'undo restores the source and redo restores the edit on one block',
          'the revision packet carries the edited source',
        ],
      },
      {
        case: c('tests/components/specs/editor-code-language.spec.ts', 'native IME composition keeps the code caret and its source'),
        proves: [
          'compositionstart is not prevented, the composed text lands at the code caret and the caret stays inside the source',
          'the highlighted block keeps painting and the revision packet carries the composed text',
        ],
      },
      {
        case: c('tests/components/specs/editor-code-language.spec.ts', 'the code language select keeps compact geometry with a truthful value at 1440px'),
        proves: [
          'the select keeps its code-language-select class and reports the selected language',
          'selecting python highlights the block and keeps the source, within the 32-44px height and 160px width bounds',
        ],
      },
      {
        case: c('tests/components/specs/editor-code-language.spec.ts', 'the code language select keeps compact geometry with a truthful value at 390px'),
        proves: [
          'the compact select keeps its class and value at the narrow width',
          'selecting python highlights the block and keeps the source inside the viewport bounds',
        ],
      },
      {
        case: c('tests/components/specs/editor-code-language.spec.ts', 'an unknown saved code language stays listed until the author picks another'),
        proves: [
          'an unsaved language keeps its value and its option outside the known list',
          'the unknown language paints no tokens, and picking ruby highlights the block',
        ],
      },
      {
        case: c('tests/components/specs/editor-code-language.spec.ts', 'selecting plain text removes the highlight without changing the source'),
        proves: [
          'plain text removes every token span while the source text stays identical',
          'returning to python repaints the tokens without touching the source',
        ],
      },
    ],
    retained: [
      {
        cases: [
          c('tests/browser/editor/source/code-language.spec.ts', 'code source and language survive save reload at 1440px'),
          c('tests/browser/editor/source/code-language.spec.ts', 'code source and language survive save reload at 390px'),
        ],
        reason: 'The typed source and its language have to reach the Worker, survive a real reload and switch back to plain text.',
      },
      {
        cases: [
          c('tests/browser/editor/source/code-language.spec.ts', 'code language persists through save reload and reader preview at 1440px'),
          c('tests/browser/editor/source/code-language.spec.ts', 'code language persists through save reload and reader preview at 390px'),
        ],
        reason: 'The reader preview and its code presentation only exist on the routed draft preview.',
      },
      {
        cases: [
          c('tests/browser/editor/source/code-language.spec.ts', 'an unknown saved code language remains intact until the author selects another language'),
        ],
        reason: 'The unknown language has to come back from the Worker and render in the reader preview.',
      },
      {
        cases: [
          c('tests/browser/editor/source/code-language.spec.ts', 'remains compact and usable after a publication lock'),
        ],
        reason: 'The publication lock is the routed application publishing the saved draft.',
      },
    ],
  },
  {
    id: 'editor.formula',
    legacy: [
      c('tests/browser/editor/source/formula-editor.spec.ts', 'new inline formulas focus their source editor at 1440px'),
      c('tests/browser/editor/source/formula-editor.spec.ts', 'new inline formulas focus their source editor at 390px'),
    ],
    component: [
      {
        case: c('tests/components/specs/editor-formula.spec.ts', 'new inline formulas focus their source editor at 1440px'),
        proves: [
          'the Inline formula control opens the Edit formula dialog focused on its source',
          'typing lands in the source, Done renders inline math and the revision packet carries the inline formula',
        ],
      },
      {
        case: c('tests/components/specs/editor-formula.spec.ts', 'new inline formulas focus their source editor at 390px'),
        proves: [
          'the focused inline dialog and its typed source work at the compact width',
          'Done renders inline math and the revision packet carries it',
        ],
      },
    ],
    retained: [
      {
        cases: [
          c('tests/browser/editor/source/formula-editor.spec.ts', 'new block formulas receive typing immediately at 1440px'),
          c('tests/browser/editor/source/formula-editor.spec.ts', 'new block formulas receive typing immediately at 390px'),
          c('tests/browser/editor/source/formula-editor.spec.ts', 'display formula rows and multiline source roundtrip at 1440px'),
          c('tests/browser/editor/source/formula-editor.spec.ts', 'display formula rows and multiline source roundtrip at 390px'),
        ],
        reason: 'These cases own the block formula save, reload and draft-reader roundtrip, which only the built application can prove.',
      },
    ],
  },
  {
    id: 'editor.links',
    legacy: [
      c('tests/browser/editor/links/link-validation.spec.ts', 'link entry rejects invalid addresses before changing the draft at 1440px'),
      c('tests/browser/editor/links/link-validation.spec.ts', 'link entry rejects invalid addresses before changing the draft at 390px'),
      c('tests/browser/editor/links/link-normalization.spec.ts', 'toolbar links validate and normalize destinations at 1440px in en'),
      c('tests/browser/editor/links/link-normalization.spec.ts', 'keyboard links validate and normalize destinations at 320px in zh'),
      c('tests/browser/editor/links/link-normalization.spec.ts', 'toolbar links validate and normalize destinations at 320px in zh'),
    ],
    component: [
      {
        case: c('tests/components/specs/editor-links.spec.ts', 'the desktop shortcut opens one link editor focused on its destination'),
        proves: [
          'the platform shortcut opens one Create link editor with the destination focused',
          'a repeated shortcut keeps a single editor',
          'cancel closes it, returns focus to the body and writes nothing',
        ],
      },
      {
        case: c('tests/components/specs/editor-links.spec.ts', 'the compact formatting drawer reaches the same link entry at 390px'),
        proves: [
          'the More formatting options drawer opens the link entry focused on its destination',
          'a typed destination applies to the selection and reaches the revision packet',
        ],
      },
      ...linkEntryMatrix,
    ],
    retained: [
      {
        cases: [
          c('tests/browser/editor/links/link-normalization.spec.ts', 'links validate and normalize destinations at 1440px in en'),
        ],
        reason: 'The one retained link persistence representative: it proves the normalized destination and the undo reach the Worker and the stored document.',
      },
    ],
  },
  {
    id: 'editor.formatting',
    legacy: [
      c('tests/browser/editor/formatting/desktop-text-colors.spec.ts', 'desktop text and highlight matrices preserve the selected range and native styles'),
      c('tests/browser/editor/formatting/format-toolbar-input.spec.ts', 'fourteen Shift+ArrowRight presses retain the complete selection and bounded toolbar'),
    ],
    component: [
      // Historical intermediate identity, kept so the two-generation chain stays
      // machine-readable: this case was fully retired and its successor is the
      // jsdom case recorded in `formatting-dom-migrations`. It is NOT a current
      // native proof, which is why the native plan no longer lists it.
      {
        case: c('tests/components/specs/editor-formatting.spec.ts', 'bold affects only the selected range and undo restores plain text'),
        proves: ['historical component identity for the Bold/undo proof; the assertion now runs in the DOM layer'],
      },
      {
        case: c('tests/components/specs/editor-formatting.spec.ts', 'the colour matrices mark their choice and apply it to the selected range'),
        proves: [
          'both colour matrices keep ten swatches in five columns and mark the chosen swatches pressed',
          'Escape closes the dialog and returns focus to the editor',
        ],
      },
      {
        case: c('tests/components/specs/editor-formatting.spec.ts', 'fourteen Shift+ArrowRight presses retain the complete selection and a bounded toolbar'),
        proves: [
          'fourteen Shift+ArrowRight presses select the whole phrase',
          'the toolbar stays inside the 701px viewport',
          'the selection and toolbar never write to the draft',
        ],
      },
    ],
    retained: [
      {
        cases: [
          c('tests/browser/editor/formatting/format-toolbar-input.spec.ts', 'touch taps preserve a partial selection through bold and the mobile color drawer'),
        ],
        reason: 'Purpose-built replacement: the retained touch formatting case still proves bold and text colour reach the Worker and survive a reload.',
      },
    ],
  },
]

function c(file: string, title: string): string {
  return `${file} :: ${title}`
}
