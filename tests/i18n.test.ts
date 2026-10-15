import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { validateI18nResources } from '../src/components/ui/ztd-me'
import { emptyDocument } from '../src/content/document'
import { DocumentReader } from '../src/features/reader/document'
import { createBlogAdapter, createBlogI18n, serverBlogTranslator } from '../src/i18n/instance'
import { EditorText } from '../src/i18n/labels'
import { en } from '../src/i18n/resources/en'
import { zhCN } from '../src/i18n/resources/zh-CN'
import { deepEqual } from './assertions'
import { renderWithLocale } from './render-fixture'

test('every UI namespace has complete Chinese keys and matching interpolation variables', () => {
  assert.deepEqual(validateI18nResources({ en, 'zh-CN': zhCN }), [])
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})

test('the production phrase facade translates editor actions, save states and confirmations', () => {
  const phrases = [
    'More formatting options',
    'Formatting options',
    'Apply formatting to the selected text.',
    'Block actions',
    'Manage this block.',
    'Choose text and background colors.',
    'Saved',
    'Unsaved changes',
    'Saving…',
    'Offline — server save pending',
    'Conflict — draft preserved',
    'Save failed',
    'Uploading media…',
    'View live document',
    'Save',
    'Publish',
    'Update publication',
    'Sync draft now',
    'Drafts save automatically. Sync now sends pending changes immediately.',
    'Back',
    'Update',
    'Unpublish this document?',
    'Delete this unpublished document? History and media will be retained.',
    'Delete document',
    'Unpublish',
    'Close',
    'Preview saved revision',
    'Draft preview',
    'Close preview',
    'Draft reader preview',
    'Preview your current draft, including unsaved changes.',
    'Complete required fields to preview this draft.',
    'Loading reader…',
    'Publishing saves your current draft before making it public.',
    'Local recovery copy',
    'Your local copy differs from this saved revision.',
    'Draft conflict',
    'This draft was updated elsewhere. Your local edits are preserved.',
    'Keep local edits',
    'Use server version',
    'Save as a new draft revision.',
    'Your local edits stay in a recovery copy.',
    'Compare changes',
    'Draft changed elsewhere',
    'Your edits are preserved. Review the latest draft before continuing.',
    'Could not complete this action',
    'Cancel',
    'Confirm',
  ]
  const elements = phrases.map(value => createElement(EditorText, { key: value, value }))
  const html = renderWithLocale(createElement('div', null, ...elements), 'zh-CN')
  for (const phrase of phrases) {
    assert.ok(!html.includes(phrase), `English phrase remains visible: ${phrase}`)
  }
  assert.ok(html.includes('已保存'))
  assert.ok(html.includes('发布'))
  assert.ok(html.includes('更新发布'))
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})

test('root instances isolate language and the adapter obeys the explicit shared locale', async () => {
  const first = createBlogI18n('en')
  const second = createBlogI18n('en')
  assert.notEqual(first, second)
  await first.changeLanguage('zh-CN')
  assert.equal(second.language, 'en')
  const adapter = createBlogAdapter(first)
  assert.ok(Object.is(createBlogAdapter(first), adapter))
  assert.notEqual(createBlogAdapter(second), adapter)
  const values = { lng: 'zh-CN', ns: 'editor', lngs: 'zh-CN' }
  const original = structuredClone(values)
  assert.equal(adapter.t('en', 'site', 'search'), 'Search')
  assert.equal(adapter.t('en', 'site', 'search', values), 'Search')
  assert.equal(adapter.t('zh-CN', 'site', 'search'), '搜索')
  assert.equal(serverBlogTranslator('en', 'site')('search'), 'Search')
  assert.equal(serverBlogTranslator('en', 'site')('search', values), 'Search')
  assert.equal(serverBlogTranslator('zh-CN', 'site')('search'), '搜索')
  deepEqual(values, original)
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})

test('UI locale translates reader navigation without translating document content', () => {
  const document = emptyDocument()
  document.meta.title = 'This title stays English'
  document.meta.description = 'Author supplied description'
  document.meta.documentLocale = 'en'
  document.references = [
    {
      id: crypto.randomUUID(),
      title: 'Author reference',
      authors: ['Author'],
      year: null,
      url: '',
      doi: '',
    },
  ]
  const noteId = crypto.randomUUID()
  const first = document.blocks[0]
  assert.ok(first !== undefined)
  first.content = [
    { type: 'footnoteRef', props: { noteId } },
  ]
  document.blocks.push({
    id: noteId,
    type: 'footnote',
    props: {},
    content: [
      { type: 'text', text: 'Author note', styles: {} },
    ],
    children: [],
  })
  const html = renderWithLocale(createElement(DocumentReader, {
    document,
    publication: { kind: 'posts', publishedAt: 0, updatedAt: 0 },
  }), 'zh-CN')
  assert.ok(html.includes('全部文章'))
  assert.ok(html.includes('This title stays English'))
  assert.ok(html.includes('Author supplied description'))
  assert.ok(html.includes('aria-label="脚注"'))
  assert.ok(html.includes('aria-label="参考文献"'))
  assert.ok(html.includes('aria-label="从脚注 1 返回正文"'))
  assert.ok(html.includes('Author reference'))
  assert.ok(html.includes('Author note'))
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})
