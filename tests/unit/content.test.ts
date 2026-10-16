import assert from 'node:assert/strict'
import { test } from 'node:test'
import { canonicalize } from '@/content/canonical'
import { emptyDocument, safeURL, validateDocument } from '@/content/document'
import { parseJSON } from '@/server/json'
import { deepEqual, equal } from '~/tests/support/unit/assertions'

test('canonical snapshots are fixed points, preserve IDs/Unicode and never mutate editor data', async () => {
  for (let seed = 0; seed < 100; seed++) {
    const input = emptyDocument()
    input.meta.title = `标题 ${seed}`
    const block = input.blocks[0]
    assert.ok(block !== undefined)
    block.content = [
      { type: 'text', text: '中\n', styles: { bold: true } },
      { type: 'text', text: '文😀', styles: { bold: true } },
      {
        type: 'link',
        href: '/posts/example',
        content: [
          { type: 'text', text: 'linked ', styles: {} },
          { type: 'text', text: 'text', styles: {} },
        ],
      },
    ]
    const before = structuredClone(input)
    const a = await canonicalize(input)
    const b = await canonicalize(JSON.parse(a.json))
    equal(a.json, b.json)
    equal(a.hash, b.hash)
    deepEqual(input, before)
    deepEqual(a.document.blocks[0]?.content, [
      { type: 'text', text: '中\n文😀', styles: { bold: true } },
      {
        type: 'link',
        href: '/posts/example',
        content: [
          { type: 'text', text: 'linked text', styles: {} },
        ],
      },
    ])
  }
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})

test('reject duplicate JSON keys, prototype pollution, malformed Unicode and hostile depth', () => {
  for (const source of [
    '{"a":1,"a":2}',
    '{"a":1,"\\u0061":2}',
    '{"__proto__":{}}',
    '{"constructor":1}',
    '"\\ud800"',
    '[1,]',
    '1 true',
    `${'['.repeat(60)}0${']'.repeat(60)}`,
  ]) {
    assert.throws(() => parseJSON(source))
  }
  deepEqual(parseJSON('{"value":"😀","arr":[1,true,null]}'), {
    value: '😀',
    arr: [
      1,
      true,
      null,
    ],
  })
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})

test('reject unknown nodes, unsafe properties, duplicate block IDs and oversize UTF-8 envelopes', async () => {
  const doc = emptyDocument()
  assert.throws(() =>
    validateDocument({
      ...doc,
      blocks: [
        { ...doc.blocks[0], type: 'rawHTML' },
      ],
    }),
  )
  assert.throws(() =>
    validateDocument({
      ...doc,
      blocks: [
        {
          ...doc.blocks[0],
          props: {
            textAlignment: 'left',
            textColor: 'url(evil)',
            backgroundColor: 'default',
          },
        },
      ],
    }),
  )
  assert.throws(() => validateDocument({ ...doc, blocks: [
    doc.blocks[0],
    doc.blocks[0],
  ] }))
  assert.throws(() =>
    validateDocument({ ...doc, meta: { ...doc.meta, title: '😀'.repeat(101) } }),
  )
  const block = doc.blocks[0]
  assert.ok(block !== undefined)
  block.content = [
    { type: 'text', text: '字'.repeat(180000), styles: {} },
  ]
  await assert.rejects(canonicalize(doc), { code: 'DOCUMENT_TOO_LARGE' })
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})

test('URL policy rejects script and credential injection', () => {
  for (const url of [
    'javascript:alert(1)',
    '//evil.test',
    'https://user:pass@evil.test',
    'mailto:x@test?body=%0aBcc:evil',
    'https:\\evil.test',
    'data:text/html,x',
    'https://a.test/%5c/b',
    ' https://a.test',
  ]) {
    equal(safeURL(url), false, url)
  }
  for (const url of [
    'https://example.com/a',
    'http://example.com',
    'mailto:hello@ztd.me',
    '/posts/entry',
    '#section',
  ]) {
    equal(safeURL(url), true, url)
  }
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})

test('eight block levels are valid and a ninth level is rejected', () => {
  const doc = emptyDocument()
  const root = doc.blocks[0]
  assert.ok(root !== undefined)
  let last = root
  for (let depth = 2; depth <= 8; depth++) {
    const child = { ...structuredClone(root), id: crypto.randomUUID(), children: [] }
    last.children = [child]
    last = child
  }
  assert.doesNotThrow(() => validateDocument(doc))
  last.children = [
    { ...structuredClone(last), id: crypto.randomUUID(), children: [] },
  ]
  assert.throws(() => validateDocument(doc))
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})

test('table occupancy validates spans, complete coverage and publication captions', async () => {
  const doc = emptyDocument()
  const id = crypto.randomUUID()
  doc.blocks = tableBlocks(id)
  doc.meta.title = 'Table'
  doc.meta.slug = 'table'
  assert.throws(() => validateDocument(doc, true))
  doc.tableAccessibility[id] = { caption: 'Comparison' }
  assert.doesNotThrow(() => validateDocument(doc, true))
  const a = await canonicalize(doc)
  equal((await canonicalize(JSON.parse(a.json))).hash, a.hash)
  const table = doc.blocks[0]?.content
  assert.ok(table !== undefined && !Array.isArray(table))
  table.rows[1] = { cells: [] }
  assert.throws(() => validateDocument(doc))
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})

function tableBlocks(id: string): ReturnType<typeof emptyDocument>['blocks'] {
  return [
    {
      id,
      type: 'table',
      props: { textColor: 'default' },
      children: [],
      content: {
        type: 'tableContent',
        columnWidths: [null, null],
        headerRows: 1,
        rows: [
          {
            cells: [
              {
                type: 'tableCell',
                props: {
                  textAlignment: 'left',
                  textColor: 'default',
                  backgroundColor: 'default',
                  rowspan: 2,
                },
                content: [],
              },
              {
                type: 'tableCell',
                props: {
                  textAlignment: 'left',
                  textColor: 'default',
                  backgroundColor: 'default',
                },
                content: [],
              },
            ],
          },
          {
            cells: [
              {
                type: 'tableCell',
                props: {
                  textAlignment: 'left',
                  textColor: 'default',
                  backgroundColor: 'default',
                },
                content: [],
              },
            ],
          },
        ],
      },
    },
  ]
}
