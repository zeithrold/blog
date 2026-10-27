import type { Block, Document } from '@/content/document'
import { emptyDocument, validateDocument } from '@/content/document'

/** Code text that must survive as literal source: markup plus a long, unwrapped line. */
export const READER_CODE_SOURCE = [
  'const journey = true',
  '\tconsole.log("<img src=x onerror=alert(1)>")',
  `// ${'long code '.repeat(35)}`,
  '',
].join('\n')

/** Accessibility name of the wide table in the reader fixture. */
export const READER_TABLE_CAPTION = 'Keyboard scroll comparison'

const textProps = { textAlignment: 'left', textColor: 'default', backgroundColor: 'default' } as const

function block(type: Block['type'], text: string, props: Block['props'] = {}): Block {
  return {
    id: crypto.randomUUID(),
    type,
    props: type === 'codeBlock' ? props : { ...textProps, ...props },
    content: [
      { type: 'text', text, styles: {} },
    ],
    children: [],
  }
}

/** Six fixed columns stay wider than any mobile reading column. */
function wideTable(id: string): Block {
  return {
    id,
    type: 'table',
    props: { textColor: 'default' },
    content: {
      type: 'tableContent',
      columnWidths: [
        200,
        200,
        200,
        200,
        200,
        200,
      ],
      headerRows: 1,
      rows: [
        {
          cells: Array.from({ length: 6 }, (_, index) => [
            {
              type: 'text' as const,
              text: `Comparison-column-${index + 1}-${'x'.repeat(30)}`,
              styles: {},
            },
          ]),
        },
      ],
    },
    children: [],
  }
}

/**
 * Reader content for the component surface: headings, list markers and code blocks
 * whose languages the reader renders without highlighting. Everything here renders
 * synchronously, so the surface needs neither the editor nor a route.
 */
export function readerFixture(): Document {
  const document = emptyDocument()
  document.meta.title = 'Reading headings and code'
  document.meta.slug = 'reader-component-content'
  const nested = block('bulletListItem', 'Nested bullet')
  nested.children = [
    block('numberedListItem', 'Nested number', { start: 4 }),
  ]
  const tableId = crypto.randomUUID()
  document.blocks = [
    block('paragraph', 'Body text and spacing'),
    ...[
      1,
      2,
      3,
    ].map(level => block('heading', `Heading 标题 ${level}`, { level })),
    nested,
    block('numberedListItem', 'Number four', { start: 4 }),
    block('codeBlock', READER_CODE_SOURCE, { language: 'text' }),
    block('codeBlock', READER_CODE_SOURCE, { language: 'legacy-lang' }),
    block('paragraph', 'After the code'),
    wideTable(tableId),
  ]
  document.tableAccessibility[tableId] = { caption: READER_TABLE_CAPTION }
  return validateDocument(document)
}
