/* eslint-disable style/max-len -- Verbatim source case references stay one per line. */
import type { DomMigrationRecord } from './dom-migrations'

const source = 'tests/components/specs/editor-source.spec.ts'
const code = 'tests/components/specs/editor-code-language.spec.ts'
const formula = 'tests/components/specs/editor-formula.spec.ts'
const math = 'tests/components/specs/editor-math.spec.ts'
const sourceDom = 'tests/dom/source-editing.test.tsx'
const codeDom = 'tests/dom/source-code.test.tsx'
const formulaDom = 'tests/dom/source-formula.test.tsx'
const mathDom = 'tests/dom/source-math.test.tsx'

function at(file: string, title: string): string {
  return `${file} :: ${title}`
}

/** Source, formula and code cases move to jsdom only where the real controls prove them. */
export const sourceDomMigrations: readonly DomMigrationRecord[] = [
  {
    id: 'editor.source-input',
    legacy: [
      at(source, 'math beforeinput deletion and line breaks respect source boundaries'),
      at(source, 'mermaid beforeinput deletion and line breaks respect source boundaries'),
      at(source, 'math rich clipboard becomes source text without creating a block'),
      at(source, 'mermaid rich clipboard becomes source text without creating a block'),
      at(source, 'math Delete at the end of its source keeps the following paragraph'),
      at(source, 'mermaid Delete at the end of its source keeps the following paragraph'),
    ],
    dom: [
      {
        case: at(sourceDom, 'math beforeinput prevents boundary deletion and inserts a source line'),
        proves: [
          'the real math Edit control opens the source at its end; forward boundary deletion is prevented without changing the source',
          'insertParagraph is prevented and the real BlockNote math source stores exactly one newline while its neighbouring paragraph remains',
          'the production draft coordinator sends the updated document through the real Client/fetch boundary',
        ],
      },
      {
        case: at(sourceDom, 'mermaid beforeinput prevents boundary deletion and inserts a source line'),
        proves: [
          'the real diagram Edit control opens the source at its end; forward boundary deletion is prevented without changing the source',
          'insertParagraph is prevented and the real BlockNote diagram source stores exactly one newline while its neighbouring paragraph remains',
          'the production draft coordinator sends the updated document through the real Client/fetch boundary',
        ],
      },
      {
        case: at(sourceDom, 'math rich clipboard on the Edit control inserts plain source without a new block'),
        proves: [
          'the real math Edit control opens the source and the production paste handler consumes text/plain rather than the declared HTML payload',
          'the pasted multiline source remains on the math block and does not create additional paragraphs',
          'the real revision request carries the updated math source',
        ],
      },
      {
        case: at(sourceDom, 'mermaid rich clipboard on the Edit control inserts plain source without a new block'),
        proves: [
          'the real diagram Edit control opens the source and the production paste handler consumes text/plain rather than the declared HTML payload',
          'the pasted multiline source remains on the diagram block and does not create additional paragraphs',
          'the real revision request carries the updated diagram source',
        ],
      },
      {
        case: at(sourceDom, 'math Delete at source end leaves the following paragraph and sends no write'),
        proves: [
          'Delete at the end of the real math source is prevented and leaves its text and following paragraph intact',
          'the source boundary sends no revision request',
        ],
      },
      {
        case: at(sourceDom, 'mermaid Delete at source end leaves the following paragraph and sends no write'),
        proves: [
          'Delete at the end of the real diagram source is prevented and leaves its text and following paragraph intact',
          'the source boundary sends no revision request',
        ],
      },
    ],
    retained: [
      {
        cases: [
          at(source, 'mermaid Delete at the end of its source keeps the following paragraph'),
        ],
        reason: 'Split, not retired: jsdom proves the source handler’s boundary state and no-write behavior. This component case keeps a browser-created caret at the Mermaid source end, real Delete default prevention and the unchanged neighbouring paragraph.',
      },
    ],
  },
  {
    id: 'editor.source-publication-lock',
    legacy: [
      at(source, 'a lone source closes without hidden editing while publication locked'),
    ],
    dom: [
      {
        case: at(sourceDom, 'a held Publish request makes the source editor read-only until its acknowledgement'),
        proves: [
          'the real Publish control holds the production action while BlockNote becomes read-only and the source Edit control disables',
          'Done remains usable during the held publish; closing changes no source content and sends no revision',
          'the acknowledgement releases the lock and the real publish request reaches the HTTP boundary',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'editor.source-close',
    legacy: [
      at(source, 'a lone source closes without hidden editing'),
    ],
    dom: [
      {
        case: at(sourceDom, 'Done closes a lone source and keeps its source text in the saved document'),
        proves: [
          'the real Edit and Done controls close the lone math source and hide its source textbox',
          'the real BlockNote editor creates the required following paragraph without changing the source',
          'the revision request still contains the unchanged math source',
        ],
      },
    ],
    retained: [
      {
        cases: [
          at(source, 'a lone source closes without hidden editing'),
        ],
        reason: 'Split, not retired: jsdom proves the Done state, unchanged source, created paragraph and request. This component case keeps native focus return after Done and browser typing into the new paragraph rather than the hidden source.',
      },
    ],
  },
  {
    id: 'editor.code-language',
    legacy: [
      at(code, 'code highlighting paints native tokens and follows the editor color mode'),
      at(code, 'native undo and redo keep the highlighted code source'),
      at(code, 'native IME composition keeps the code caret and its source'),
      at(code, 'the code language select keeps compact geometry with a truthful value at 1440px'),
      at(code, 'the code language select keeps compact geometry with a truthful value at 390px'),
      at(code, 'an unknown saved code language stays listed until the author picks another'),
      at(code, 'selecting plain text removes the highlight without changing the source'),
    ],
    dom: [
      {
        case: at(codeDom, 'the real code highlighter renders tokens while preserving the selected language and source'),
        proves: [
          'the production code view and Shiki extension render token spans for a saved Python source',
          'the actual editor block remains Python and its source is unchanged',
        ],
      },
      {
        case: at(codeDom, 'the code language select updates the real block and saves its source at 1440px'),
        proves: [
          'the real native select exposes its code-language class and truthful text value',
          'selecting Python updates the real BlockNote code block while preserving the source',
          'the production draft and Client send the selected language and source in the revision packet',
        ],
      },
      {
        case: at(codeDom, 'the code language select updates the real block and saves its source at 390px'),
        proves: [
          'the real native select exposes its code-language class and truthful value at the compact host width',
          'selecting Python updates the real BlockNote code block while preserving the source',
          'the production draft and Client send the selected language and source in the revision packet',
        ],
      },
      {
        case: at(codeDom, 'an unknown saved code language remains listed until the author selects another'),
        proves: [
          'an unknown saved language remains the select value and option while it produces no Shiki tokens',
          'choosing Ruby updates the actual code block and preserves the original source in the revision packet',
        ],
      },
      {
        case: at(codeDom, 'plain text removes syntax tokens and Python restores them without changing the source'),
        proves: [
          'selecting plain text removes the Shiki token spans from the actual code view',
          'returning to Python restores token spans without changing the source',
          'the final language and source reach the real revision request',
        ],
      },
    ],
    retained: [
      {
        cases: [
          at(code, 'code highlighting paints native tokens and follows the editor color mode'),
        ],
        reason: 'Split, not retired: jsdom proves the source, selected language and token DOM. This component case keeps painted token colors and computed light/dark style changes while the highlighter repaints the connected code element.',
      },
      {
        cases: [
          at(code, 'native undo and redo keep the highlighted code source'),
        ],
        reason: 'Split, not retired: jsdom proves the initial Python token DOM and unchanged source. The browser case keeps native caret placement, contenteditable typing, ProseMirror undo/redo history and the resulting input packet.',
      },
      {
        cases: [
          at(code, 'native IME composition keeps the code caret and its source'),
        ],
        reason: 'Split, not retired: jsdom proves the initial token DOM and source. The browser case keeps actual IME composition delivery, caret/range placement, committed text and the re-highlighted input packet.',
      },
      {
        cases: [
          at(code, 'the code language select keeps compact geometry with a truthful value at 1440px'),
        ],
        reason: 'Split, not retired: jsdom proves the select value, language update, source preservation and request shape. This component case keeps the measured 1440px selector height, width and viewport containment.',
      },
      {
        cases: [
          at(code, 'the code language select keeps compact geometry with a truthful value at 390px'),
        ],
        reason: 'Split, not retired: jsdom proves the compact-width select value, language update, source preservation and request shape. This component case keeps the measured selector bounds and containment in the 390px viewport.',
      },
    ],
  },
  {
    id: 'editor.formula',
    legacy: [
      at(formula, 'new inline formulas focus their source editor at 1440px'),
      at(formula, 'new inline formulas focus their source editor at 390px'),
    ],
    dom: [
      {
        case: at(formulaDom, 'the Inline formula toolbar edits and saves its source at 1440px'),
        proves: [
          'the production Inline formula toolbar inserts a real inlineMath node at the test cursor',
          'the real Formula source input receives focus, accepts a^2, and Done closes its editor',
          'the real revision request carries the inlineMath source',
        ],
      },
      {
        case: at(formulaDom, 'the Inline formula toolbar edits and saves its source at 390px'),
        proves: [
          'the production Inline formula toolbar inserts a real inlineMath node at the test cursor',
          'the compact Formula source control receives focus, accepts a^2, and Done closes its editor',
          'the real revision request carries the inlineMath source',
        ],
      },
      {
        case: at(mathDom, 'real reader inline math previews render their source as MathML'),
        proves: [
          'the real reader renders the source saved by an inlineMath node as MathML without changing the inline source',
        ],
      },
      {
        case: at(formulaDom, 'the inline MathML oracle rejects a stale source rendered by the real InlineMathView'),
        proves: [
          'the literal a^2 MathML structure oracle throws for the real InlineMathView rendered from a^3, proving the assertion discriminates wrong source',
        ],
      },
    ],
    retained: [
      {
        cases: [
          at(formula, 'new inline formulas focus their source editor at 1440px'),
        ],
        reason: 'Split, not retired: jsdom proves the toolbar-to-inline node, source input, Done action and request. This component case keeps the actual browser caret created by sequential typing and its focus transfer when the toolbar inserts a formula at that caret.',
      },
      {
        cases: [
          at(formula, 'new inline formulas focus their source editor at 390px'),
        ],
        reason: 'Split, not retired: jsdom proves the compact drawer, focused source input and request. This component case keeps the actual browser caret created by sequential typing and its focus transfer when the toolbar inserts a formula at that caret.',
      },
    ],
  },
  {
    id: 'editor.math-preview',
    legacy: [
      at(math, 'formula previews keep natural height and reachable horizontal content at 1440px'),
      at(math, 'formula previews keep natural height and reachable horizontal content at 390px'),
    ],
    dom: [
      {
        case: at(mathDom, 'real reader block previews render MathML for every editor fixture without changing source'),
        proves: [
          'the real reader renders MathML for all four display formula fixtures',
          'the display source blocks remain unchanged while their MathML views render',
        ],
      },
    ],
    retained: [
      {
        cases: [
          at(math, 'formula previews keep natural height and reachable horizontal content at 1440px'),
        ],
        reason: 'Split, not retired: jsdom proves the MathML output and unchanged block/inline sources. The component case keeps measured natural height, vertical overflow and first/last-term reachability through real horizontal scrolling at 1440px.',
      },
      {
        cases: [
          at(math, 'formula previews keep natural height and reachable horizontal content at 390px'),
        ],
        reason: 'Split, not retired: jsdom proves the MathML output and unchanged block/inline sources. The component case keeps measured natural height, vertical overflow and first/last-term reachability through real horizontal scrolling at 390px.',
      },
    ],
  },
]
