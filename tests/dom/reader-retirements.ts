/* eslint-disable style/max-len -- Per-assertion evidence stays on one readable line. */
type RetainedAssertion = {
  readonly assertion: string
  readonly reason: string
}

type ReaderRetirement = {
  readonly case: string
  readonly moved: readonly string[]
  readonly retained: readonly RetainedAssertion[]
}

const publicReader = 'tests/browser/reader/public-reader.spec.ts'
const typography = 'tests/browser/reader/typography.spec.ts'
const typographyWidths = [
  1440,
  390,
  320,
]

const movedTypographyAssertions = [
  'headings, list groups and start positions retain their rendered semantic elements and declared typography classes',
  'read-only tasks retain accessible names, checked states, disabled states and nested rendered text',
  'highlighted source retains exact text without turning embedded image or script markup into elements',
]

const retainedTypographyAssertions = [
  {
    assertion: 'heading families, font sizes and line heights; list marker types; and code font, size, whitespace and overflow styles are computed for the real reader',
    reason: 'jsdom does not load production fonts or compute browser styles; these measurements use the real preview and published reader stylesheet.',
  },
  {
    assertion: 'heading sizes remain ordered and code has actual horizontal overflow while staying within the viewport',
    reason: 'Font metrics, element bounds, scrollWidth and clientWidth depend on the browser layout engine.',
  },
  {
    assertion: 'checkbox dimensions and horizontal bounds remain valid at the selected viewport',
    reason: 'The 24px control dimensions and bounds are computed-style and geometry assertions.',
  },
  {
    assertion: 'highlighted token colors change between the real light and dark reader themes and persist after reload',
    reason: 'The palette is a computed CSS-color contract exercised through real browser preferences and a page reload.',
  },
  {
    assertion: 'Tab reaches the next reader link, using the native WebKit Option-Tab sequence where required',
    reason: 'jsdom does not implement the browser or operating-system keyboard focus sequence.',
  },
  {
    assertion: 'the same reader content survives the actual preview, publication route and public-page reload',
    reason: 'The preview, Worker publication and public route require the built application and its real HTTP boundary.',
  },
]

export const readerRetirements: readonly ReaderRetirement[] = [
  {
    case: `${publicReader} :: article contents reveal nested details and continue keyboard reading at the selected heading`,
    moved: [
      'the Reader sections navigation exposes its two links and their exact heading fragment targets',
      'nested disclosure markup starts closed before any link interaction',
      'the table caption names a focusable region containing the semantic table',
    ],
    retained: [
      {
        assertion: 'publishing and requesting /posts/<slug> produces a successful response rendered by the built Worker application',
        reason: 'The public HTTP response and routed server rendering are unavailable to a jsdom mount.',
      },
      {
        assertion: 'a modified click leaves the native fragment link and current reader state to the browser',
        reason: 'Modified-click and new-tab behavior are browser navigation semantics.',
      },
      {
        assertion: 'activating the contents link updates the URL and opens nested disclosures',
        reason: 'Fragment navigation and disclosure state changes require a real browser event path.',
      },
      {
        assertion: 'the selected heading receives native focus below the app bar',
        reason: 'Native focus delivery and sticky-header position require the browser layout and focus engines.',
      },
      {
        assertion: 'Tab reaches the following article link with the native browser sequence',
        reason: 'jsdom cannot establish browser keyboard focus delivery.',
      },
      {
        assertion: 'Back, Forward, direct-fragment navigation and reload restore the selected disclosure and heading focus',
        reason: 'The browser history stack, routed page lifecycle and focus restoration are native navigation behavior.',
      },
      {
        assertion: 'the table region is visible and its scrollWidth exceeds clientWidth at the mobile viewport',
        reason: 'Visibility and the scroll-area dimensions depend on the browser layout engine.',
      },
      {
        assertion: 'the table region receives native focus and ArrowRight/ArrowLeft change its scrollLeft',
        reason: 'The keyboard event path and actual horizontal scrolling are browser behavior.',
      },
      {
        assertion: 'the mobile document itself does not overflow horizontally',
        reason: 'Document scrollWidth and viewport width are computed browser geometry.',
      },
    ],
  },
  ...typographyWidths.map((width): ReaderRetirement => ({
    case: `${typography} :: reader headings, list markers and highlighted code survive preview and publication at ${width}px`,
    moved: movedTypographyAssertions,
    retained: retainedTypographyAssertions,
  })),
]
