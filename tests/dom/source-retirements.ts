/* eslint-disable style/max-len -- Exact case keys and assertion reasons stay on one line. */
/**
 * Native source/code/formula cases that remain in the component browser suite.
 *
 * A DOM successor names only assertions it actually carries. The remaining
 * assertions explain why each exact Playwright registration still runs.
 */
export type SourceNativeAssertion = {
  readonly assertion: string
  readonly reason: string
}

export type SourceRetirement = {
  readonly playwright: string
  readonly dom: readonly string[]
  readonly moved: readonly string[]
  readonly remainsNative: readonly SourceNativeAssertion[]
}

type SourceDomSuccessor = Pick<SourceRetirement, 'dom' | 'moved'>

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

function native(
  file: string,
  title: string,
  remainsNative: readonly SourceNativeAssertion[],
  successor?: SourceDomSuccessor,
): SourceRetirement {
  return {
    playwright: at(file, title),
    dom: successor?.dom ?? [],
    moved: successor?.moved ?? [],
    remainsNative,
  }
}

const sourceInputNative = [
  'The selected math or diagram is a real ProseMirror NodeSelection; the first Enter opens its source with the browser caret inside the native contenteditable.',
  'The next Enter inserts a line and sequential browser typing places q at that caret; the revision packet carries the inserted text.',
]
const selectedTypingNative = [
  'Backspace selects the actual source block, and native typing opens it while preserving every character and the neighbouring paragraph.',
  'The revision packet contains the text entered through the browser contenteditable.',
]
const noKeydownNative = [
  'The actual selected source receives keyboard.insertText without a keydown and updates its native text selection.',
  'The revision packet carries the inserted character from that browser input path.',
]
const compositionNative = [
  'compositionstart is delivered to the real source selection without prevention and leaves the native caret inside the source.',
  'IME composition suppresses Enter, commits the composed character at its range and reaches the revision packet.',
]

export const sourceRetirements: readonly SourceRetirement[] = [
  native(source, 'math Enter enters source text before the next Enter inserts a line', [
    { assertion: sourceInputNative[0] ?? '', reason: 'A jsdom ProseMirror transaction is not a native contenteditable caret or keyboard-delivery proof.' },
    { assertion: sourceInputNative[1] ?? '', reason: 'The browser-generated character input and caret position after Enter are native input behavior; the DOM layer proves the separate beforeinput newline rule.' },
  ]),
  native(source, 'mermaid Enter enters source text before the next Enter inserts a line', [
    { assertion: sourceInputNative[0] ?? '', reason: 'A jsdom ProseMirror transaction is not a native contenteditable caret or keyboard-delivery proof.' },
    { assertion: sourceInputNative[1] ?? '', reason: 'The browser-generated character input and caret position after Enter are native input behavior; the DOM layer proves the separate beforeinput newline rule.' },
  ]),
  native(source, 'math typing on a selected source preserves every character and the block', [
    { assertion: selectedTypingNative[0] ?? '', reason: 'The case starts from a browser-created NodeSelection and sends real keyboard input through the source contenteditable.' },
    { assertion: selectedTypingNative[1] ?? '', reason: 'The native keystrokes, caret and resulting request are one integrated editor input path.' },
  ]),
  native(source, 'mermaid typing on a selected source preserves every character and the block', [
    { assertion: selectedTypingNative[0] ?? '', reason: 'The case starts from a browser-created NodeSelection and sends real keyboard input through the source contenteditable.' },
    { assertion: selectedTypingNative[1] ?? '', reason: 'The native keystrokes, caret and resulting request are one integrated editor input path.' },
  ]),
  native(source, 'math text insertion without keydown keeps its selected node', [
    { assertion: noKeydownNative[0] ?? '', reason: 'The selected NodeSelection and browser insertText delivery are native selection/input behavior.' },
    { assertion: noKeydownNative[1] ?? '', reason: 'The real editor transaction and request begin from browser input without a keydown.' },
  ]),
  native(source, 'mermaid text insertion without keydown keeps its selected node', [
    { assertion: noKeydownNative[0] ?? '', reason: 'The selected NodeSelection and browser insertText delivery are native selection/input behavior.' },
    { assertion: noKeydownNative[1] ?? '', reason: 'The real editor transaction and request begin from browser input without a keydown.' },
  ]),
  native(source, 'math composition starts inside source and keeps its range', [
    { assertion: compositionNative[0] ?? '', reason: 'IME composition and its native source caret/range are not represented by jsdom.' },
    { assertion: compositionNative[1] ?? '', reason: 'The browser composition sequence and committed character are native IME behavior.' },
  ]),
  native(source, 'mermaid composition starts inside source and keeps its range', [
    { assertion: compositionNative[0] ?? '', reason: 'IME composition and its native source caret/range are not represented by jsdom.' },
    { assertion: compositionNative[1] ?? '', reason: 'The browser composition sequence and committed character are native IME behavior.' },
  ]),
  native(source, 'reverse cross-block selection keeps Mod+A at document scope', [
    { assertion: 'A reverse browser selection from source text across neighbouring blocks widens to the whole document when Mod+A is pressed.', reason: 'Native DOM selection direction, browser shortcut delivery and ProseMirror selection synchronization are the assertion.' },
    { assertion: 'The expanded selection leaves the draft unchanged.', reason: 'The no-write result follows the browser-native selection path.' },
  ]),
  native(
    source,
    'a lone source closes without hidden editing',
    [
      { assertion: 'After Done closes a lone source, the browser returns focus to the editor body and sequential typing creates the following paragraph instead of changing hidden source.', reason: 'Native focus return and browser caret placement after closing the source editor are not established by jsdom.' },
    ],
    {
      dom: [
        at(sourceDom, 'Done closes a lone source and keeps its source text in the saved document'),
      ],
      moved: [
        'The real Edit and Done controls open and close the source editor, preserve its text, create the required paragraph, and carry the unchanged source in the revision packet.',
      ],
    },
  ),
  native(source, 'math paste into a node-selected source keeps its plain text', [
    { assertion: 'A rich paste starts from a browser-created NodeSelection and the source handler moves that native selection into the code editor.', reason: 'The NodeSelection-to-source transition is native selection behavior.' },
    { assertion: 'Pasted plain text stays on the selected math block, keeps the neighbouring paragraph and reaches the revision packet.', reason: 'The selected-node paste route is the native assertion; the DOM cases exercise the Edit-control paste path.' },
  ]),
  native(source, 'mermaid paste into a node-selected source keeps its plain text', [
    { assertion: 'A rich paste starts from a browser-created NodeSelection and the source handler moves that native selection into the code editor.', reason: 'The NodeSelection-to-source transition is native selection behavior.' },
    { assertion: 'Pasted plain text stays on the selected diagram block, keeps the neighbouring paragraph and reaches the revision packet.', reason: 'The selected-node paste route is the native assertion; the DOM cases exercise the Edit-control paste path.' },
  ]),
  native(
    source,
    'mermaid Delete at the end of its source keeps the following paragraph',
    [
      { assertion: 'A browser Delete key at the real source-end caret is default-prevented and the Mermaid source and following paragraph remain unchanged.', reason: 'The real caret, browser-generated Delete event and its default-prevention effect require the native editing engine.' },
    ],
    {
      dom: [
        at(sourceDom, 'mermaid Delete at source end leaves the following paragraph and sends no write'),
      ],
      moved: [
        'The production source handler refuses Delete at the boundary, leaves the source and neighbour unchanged, and sends no revision.',
      ],
    },
  ),
  native(
    code,
    'code highlighting paints native tokens and follows the editor color mode',
    [
      { assertion: 'The syntax tokens’ computed colors change in dark mode and return to the light color when the editor mode changes back.', reason: 'Painted token colors and computed styles require a browser rendering engine.' },
      { assertion: 'The code element remains connected while the highlighter repaints its token tree.', reason: 'The assertion observes the live browser paint/update path during a theme transition.' },
    ],
    {
      dom: [
        at(codeDom, 'the real code highlighter renders tokens while preserving the selected language and source'),
      ],
      moved: [
        'The real code component produces Shiki token spans for the selected Python language while preserving its source text.',
      ],
    },
  ),
  native(
    code,
    'native undo and redo keep the highlighted code source',
    [
      { assertion: 'A browser caret at the end of the code accepts typed text and keeps the source’s highlighted token structure.', reason: 'Native caret placement and contenteditable keyboard input are browser behavior.' },
      { assertion: 'Undo and redo restore the original and edited source through the real ProseMirror history.', reason: 'The native editor history and keyboard shortcuts are the assertion.' },
      { assertion: 'The edited source reaches the revision packet after the native input sequence.', reason: 'The packet is the result of browser-generated editor input and history.' },
    ],
    {
      dom: [
        at(codeDom, 'the real code highlighter renders tokens while preserving the selected language and source'),
      ],
      moved: ['The initial Python code view contains real token spans and leaves its source unchanged.'],
    },
  ),
  native(
    code,
    'native IME composition keeps the code caret and its source',
    [
      { assertion: 'Composition starts at the native code caret, and the composed text lands at that caret without leaving the code element.', reason: 'IME composition ranges and caret placement require the browser input engine.' },
      { assertion: 'The composed text is highlighted and reaches the revision packet.', reason: 'The composition commit and re-highlight occur on the browser-native input path.' },
    ],
    {
      dom: [
        at(codeDom, 'the real code highlighter renders tokens while preserving the selected language and source'),
      ],
      moved: ['The initial Python code view contains real token spans and leaves its source unchanged.'],
    },
  ),
  native(
    code,
    'the code language select keeps compact geometry with a truthful value at 1440px',
    [
      { assertion: 'The native selector height stays between 32px and 44px and its width stays at or below 160px.', reason: 'The selector’s measured dimensions are browser layout facts.' },
      { assertion: 'The selector stays within the 1440px viewport.', reason: 'Viewport containment requires real element geometry.' },
    ],
    {
      dom: [
        at(codeDom, 'the code language select updates the real block and saves its source at 1440px'),
      ],
      moved: [
        'The real select exposes its class and current value; choosing Python updates the real block’s language while preserving the code source and revision packet.',
      ],
    },
  ),
  native(
    code,
    'the code language select keeps compact geometry with a truthful value at 390px',
    [
      { assertion: 'The native selector keeps its compact height and width and stays inside the 390px viewport.', reason: 'Compact control bounds are measured browser layout facts.' },
    ],
    {
      dom: [
        at(codeDom, 'the code language select updates the real block and saves its source at 390px'),
      ],
      moved: [
        'The real select exposes its class and current value; choosing Python updates the real block’s language while preserving the code source and revision packet.',
      ],
    },
  ),
  native(
    formula,
    'new inline formulas focus their source editor at 1440px',
    [
      { assertion: 'Sequential keyboard input creates the real editor caret, and toolbar insertion transfers native focus from that caret to the new formula source.', reason: 'The actual browser caret and focus transfer after toolbar insertion are the retained native assertion.' },
    ],
    {
      dom: [
        at(formulaDom, 'the Inline formula toolbar edits and saves its source at 1440px'),
        at(mathDom, 'real reader inline math previews render their source as MathML'),
      ],
      moved: [
        'The production Inline formula toolbar inserts the inline node; its source field accepts the formula and Done sends the inlineMath source in the revision packet.',
        'The real Reader renders the saved inlineMath source as MathML.',
      ],
    },
  ),
  native(
    formula,
    'new inline formulas focus their source editor at 390px',
    [
      { assertion: 'Sequential keyboard input creates the real editor caret, and toolbar insertion transfers native focus from that caret to the new formula source.', reason: 'The actual browser caret and focus transfer after toolbar insertion are the retained native assertion.' },
    ],
    {
      dom: [
        at(formulaDom, 'the Inline formula toolbar edits and saves its source at 390px'),
        at(mathDom, 'real reader inline math previews render their source as MathML'),
      ],
      moved: [
        'The production Inline formula toolbar inserts the inline node; its source field accepts the formula and Done sends the inlineMath source in the revision packet.',
        'The real Reader renders the saved inlineMath source as MathML.',
      ],
    },
  ),
  native(
    math,
    'formula previews keep natural height and reachable horizontal content at 1440px',
    [
      { assertion: 'Each displayed formula fits its natural vertical box without vertical overflow.', reason: 'Natural height, overflow and painted MathML bounds require browser layout.' },
      { assertion: 'The wide formula scrolls horizontally with its first and last terms reachable at the scroll endpoints.', reason: 'Horizontal scroll width, scroll position and term rectangles require browser layout and scrolling.' },
    ],
    {
      dom: [
        at(mathDom, 'real reader block previews render MathML for every editor fixture without changing source'),
      ],
      moved: ['The real Reader renders MathML for the four display formula fixtures without changing their source.'],
    },
  ),
  native(
    math,
    'formula previews keep natural height and reachable horizontal content at 390px',
    [
      { assertion: 'Each displayed formula fits its natural vertical box without vertical overflow.', reason: 'Natural height, overflow and painted MathML bounds require browser layout.' },
      { assertion: 'The wide formula scrolls horizontally with its first and last terms reachable at the scroll endpoints.', reason: 'Horizontal scroll width, scroll position and term rectangles require browser layout and scrolling.' },
    ],
    {
      dom: [
        at(mathDom, 'real reader block previews render MathML for every editor fixture without changing source'),
      ],
      moved: ['The real Reader renders MathML for the four display formula fixtures without changing their source.'],
    },
  ),
]
