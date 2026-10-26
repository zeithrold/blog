/* eslint-disable style/max-len -- Exact case references and proof statements stay on one line. */
import type { DomMigrationRecord } from './dom-migrations'

const component = 'tests/components/specs/reader-content.spec.ts'
const publicReader = 'tests/browser/reader/public-reader.spec.ts'
const typography = 'tests/browser/reader/typography.spec.ts'
const dom = 'tests/dom/reader-content.test.tsx'

function at(file: string, title: string): string {
  return `${file} :: ${title}`
}

const languages = ['text', 'legacy-lang'] as const
const widths = [
  1440,
  390,
  320,
]

/** DOM successors for reader markup; native cases remain only for routing, fonts, styles and geometry. */
export const readerDomMigrations: readonly DomMigrationRecord[] = [
  {
    id: 'reader.content-dom',
    legacy: [
      ...languages.flatMap(language => [
        at(typography, `reader preserves unhighlighted ${language} source as literal text`),
        at(component, `reader preserves unhighlighted ${language} source as literal text`),
      ]),
      at(publicReader, 'article table captions name keyboard-scrollable regions without overflowing the mobile page'),
      at(component, 'article table captions name keyboard-scrollable regions without overflowing the mobile page'),
      at(publicReader, 'article contents reveal nested details and continue keyboard reading at the selected heading'),
      ...widths.map(width =>
        at(typography, `reader headings, list markers and highlighted code survive preview and publication at ${width}px`)),
    ],
    dom: [
      {
        case: at(dom, 'reader preserves unhighlighted text source as literal text'),
        proves: [
          'text-language source renders exactly as text without token, image or script elements',
          'the real code block retains its horizontal-overflow utility class and monospace code class',
        ],
      },
      {
        case: at(dom, 'reader preserves unhighlighted legacy-lang source as literal text'),
        proves: [
          'unknown-language source renders exactly as text without token, image or script elements',
          'the real code block retains its horizontal-overflow utility class and monospace code class',
        ],
      },
      {
        case: at(dom, 'reader headings, lists and tasks preserve semantic markup and typography classes'),
        proves: [
          'reader headings render as h2, h3 and h4 while the real article and body retain their declared typography classes',
          'ordered and unordered content retains list markup and declared marker classes',
          'the ordered list starting at 4 groups both consecutive items in one semantic list',
          'read-only tasks expose their names, checked states and disabled state while nested task text remains rendered',
        ],
      },
      {
        case: at(dom, 'reader highlights source as text without interpreting embedded markup'),
        proves: [
          'the real highlighted code block preserves the exact source text after syntax tokenization',
          'embedded image and script-looking source remains text after the highlighter renders tokens',
        ],
      },
      {
        case: at(dom, 'reader table captions name focusable regions and preserve table semantics'),
        proves: [
          'the real table caption labels its focusable region through aria-labelledby',
          'the region contains a table with six column headers',
        ],
      },
      {
        case: at(dom, 'reader contents link to nested headings without opening disclosure details'),
        proves: [
          'the named contents navigation links to the rendered first and nested headings',
          'both nested disclosure elements remain closed before native navigation begins',
        ],
      },
    ],
    retained: [
      {
        cases: [
          at(publicReader, 'article contents reveal nested details and continue keyboard reading at the selected heading'),
        ],
        reason: 'The case retains the built Worker public response, hash and browser-history navigation, native focus and disclosure behavior, and measured mobile table scrolling.',
      },
      {
        cases: widths.map(width =>
          at(typography, `reader headings, list markers and highlighted code survive preview and publication at ${width}px`)),
        reason: 'The cases retain real preview/publication routes, loaded fonts, computed typography and token colors, native keyboard focus, and measured responsive code/task geometry.',
      },
    ],
  },
]
