import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { emptyDocument, validateDocument } from '../src/content/document'
import { DocumentReader } from '../src/features/reader/document'
import { renderWithLocale } from './render-fixture'

test('reader escapes native text and preserves false task status', () => {
  const document = emptyDocument()
  document.meta.title = '<script>alert(1)</script>'
  document.meta.slug = 'safe-reader'
  document.meta.seo.noindex = true
  document.blocks = [
    {
      id: crypto.randomUUID(),
      type: 'checkListItem',
      props: {
        backgroundColor: 'default',
        textColor: 'default',
        textAlignment: 'left',
        checked: false,
      },
      content: [
        { type: 'text', text: '<img src=x onerror=alert(1)>', styles: {} },
      ],
      children: [],
    },
  ]
  const html = renderWithLocale(
    createElement(DocumentReader, { document: validateDocument(document, true) }),
  )
  assert.ok(html.includes('Not completed'))
  assert.ok(html.includes('☐'))
  assert.ok(html.includes('name="robots" content="noindex, nofollow"'))
  assert.ok(html.includes('&lt;script&gt;'))
  assert.ok(!html.includes('<script>'))
  assert.ok(!html.includes('<img'))
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})
