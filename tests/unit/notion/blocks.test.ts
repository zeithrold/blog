import assert, { deepEqual, equal } from 'node:assert/strict'
import { test } from 'node:test'
import { canonicalId } from '@/server/notion/api'
import { convertBlocks } from '@/server/notion/blocks'
import { decorations, publicLink } from '@/server/notion/rich-text'
import { blockValue, item, pageId, rich, stored } from './fixtures'

test('current Notion page URLs resolve to eligible public routes only', () => {
  const links = { [canonicalId(pageId)]: '/posts/original' as const }
  equal(publicLink(`https://app.notion.com/p/Actual-title-${canonicalId(pageId)}#section`, links), '/posts/original#section')
  equal(publicLink(`https://workspace.notion.site/${canonicalId(pageId)}`, links), '/posts/original')
  equal(publicLink(`https://app.notion.com/p/${canonicalId(pageId)}`, {}), null)
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('rich text preserves native foreground and background colors', () => {
  const text = rich('Colored text')
  deepEqual(decorations([
    { ...text, annotations: { ...text.annotations, color: 'green' } },
    { ...text, annotations: { ...text.annotations, color: 'red_background' } },
    text,
  ], {}), [
    [
      'Colored text',
      [
        ['h', 'teal'],
      ],
    ],
    [
      'Colored text',
      [
        ['h', 'red_background'],
      ],
    ],
    ['Colored text'],
  ])
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('table conversion preserves every cell, column order and header direction', () => {
  const table = stored('table', 'table', {
    table_width: 3,
    has_column_header: true,
    has_row_header: false,
  }, { parentId: pageId, children: ['row'] })
  const row = stored('row', 'table_row', { cells: [
    [
      rich('A'),
    ],
    [
      rich('B'),
    ],
    [
      rich('C'),
    ],
  ] }, { parentId: 'table' })
  const map = convertBlocks(item(), [table, row], {}).recordMap
  const converted = blockValue(map, 'table')
  if (converted?.type !== 'table') {
    assert.fail('Missing table')
  }
  deepEqual(converted.format.table_block_column_order, [
    '0',
    '1',
    '2',
  ] as const)
  equal(converted.format.table_block_column_header, true)
  equal(converted.format.table_block_row_header, false)
  const cells = blockValue(map, 'row')
  if (cells?.type !== 'table_row') {
    assert.fail('Missing row')
  }
  deepEqual(cells.properties, { 0: [
    ['A'],
  ], 1: [
    ['B'],
  ], 2: [
    ['C'],
  ] })
  const root = blockValue(map, pageId)
  if (root?.type !== 'page') {
    assert.fail('Missing root page')
  }
  deepEqual(root.properties?.title, [
    ['Actual title'],
  ])
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('eligible page links preserve fragments while private mentions remain plain text', () => {
  const target = '33333333-3333-4333-8333-333333333333'
  const text = { ...rich('Link'), text: { content: 'Link', link: { url: `https://www.notion.so/${target}#section` } } }
  const mention = { ...rich('Private title'), type: 'mention', mention: { type: 'page', page: { id: pageId } } }
  const map = convertBlocks(item(), [
    stored('text', 'paragraph', { rich_text: [text, mention] }),
  ], {
    [canonicalId(target)]: '/pages/target',
  }).recordMap
  const block = blockValue(map, 'text')
  if (block?.type !== 'text') {
    assert.fail('Missing paragraph')
  }
  deepEqual(block.properties?.title, [
    [
      'Link',
      [
        ['a', '/pages/target#section'],
      ],
    ],
    ['Private title'],
  ] as const)
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('signed media sets the earliest expiry and PDF converts to a downloadable file', () => {
  const expiry = '2026-11-13T07:00:00Z'
  const result = convertBlocks(item(), [
    stored('pdf', 'pdf', { type: 'file', file: { url: 'https://example.test/report.pdf', expiry_time: expiry }, caption: [] }),
  ], {})
  equal(result.mediaExpiresAt, Date.parse(expiry))
  const pdf = blockValue(result.recordMap, 'pdf')
  if (pdf?.type !== 'file') {
    assert.fail('PDF must use file renderer')
  }
  deepEqual(pdf.properties.source, [
    ['https://example.test/report.pdf'],
  ] as const)
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('unknown, incomplete, external synced and malformed table blocks fail explicitly', () => {
  for (const block of [
    stored('unknown', 'unsupported', {}),
    stored('incomplete', 'paragraph', {}),
    stored('synced', 'synced_block', { synced_from: { type: 'block_id', block_id: 'private' } }),
  ]) {
    assert.throws(() => convertBlocks(item(), [block], {}))
  }
  assert.throws(() => convertBlocks(item(), [
    stored('table', 'table', {
      table_width: 2,
      has_column_header: false,
      has_row_header: true,
    }, { parentId: pageId, children: ['row'] }),
    stored('row', 'table_row', { cells: [
      [
        rich('only one'),
      ],
    ] }, { parentId: 'table' }),
  ], {}))
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))
