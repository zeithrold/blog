import type { Runtime } from '~/tests/support/worker/runtime'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import process from 'node:process'
import { test } from 'node:test'
import { z } from 'zod'
import { canonicalize, extractText, hanTokens } from '@/content/canonical'
import { emptyDocument } from '@/content/document'
import { equal } from '~/tests/support/unit/assertions'
import { runtime } from '~/tests/support/worker/runtime'

const searchResults = z.object({ items: z.array(z.object({ path: z.string() })), nextOffset: z.number().nullable() })

async function templates() {
  const document = emptyDocument()
  document.meta.title = 'Scale TOKENNUMBER'
  document.meta.slug = 'scale-tokennumber'
  const paragraph = document.blocks[0]
  assert.ok(paragraph !== undefined)
  paragraph.content = [
    {
      type: 'text',
      text: '中文搜索 tokenTOKENNUMBER ERR_CONNECTION_RESET 原生数据',
      styles: {},
    },
  ]
  const publicTemplate = await canonicalize(document)
  document.meta.seo.noindex = true
  return {
    public: publicTemplate.json,
    private: (await canonicalize(document)).json,
    text: extractText(publicTemplate.document).normalize('NFKC'),
  }
}
function rows(start: number, stop: number, template: Awaited<ReturnType<typeof templates>>) {
  return Array.from({ length: stop - start }, (_, index) => {
    const number = start + index
    const noindex = number % 97 === 0
    const json = (noindex ? template.private : template.public)
      .replaceAll('TOKENNUMBER', String(number))
      .replaceAll('tokennumber', String(number))
    const text = template.text.replaceAll('TOKENNUMBER', String(number))
    const suffix = number.toString(16).padStart(12, '0')
    return {
      id: `10000000-0000-4000-8000-${suffix}`,
      revision: `20000000-0000-4000-8000-${suffix}`,
      json,
      hash: createHash('sha256').update(json).digest('hex'),
      bytes: new TextEncoder().encode(json).byteLength,
      title: `Scale ${number}`,
      path: `/posts/scale-${number}`,
      text,
      han: hanTokens(text),
      searchable: noindex ? 0 : 1,
    }
  })
}
async function seed(db: Runtime['db'], values: ReturnType<typeof rows>) {
  const batch = JSON.stringify(values)
  const field = (name: string) => `json_extract(value,'$.${name}')`
  await db.batch([
    db
      .prepare(
        `INSERT INTO documents(id,kind,created_at,updated_at) SELECT ${field('id')},'article',1,1 FROM json_each(?)`,
      )
      .bind(batch),
    db
      .prepare(
        `INSERT INTO revisions(id,document_id,sequence,schema_version,
      canonical_json,content_sha256,canonical_bytes,reason,actor_sub,created_at)

      SELECT ${field('revision')},${field('id')},1,1,${field('json')},${field('hash')},
      ${field('bytes')},'create','scale-fixture',1
      FROM json_each(?)`,
      )
      .bind(batch),
    db
      .prepare(
        `UPDATE documents SET head_revision_id=(SELECT ${field('revision')}
      FROM json_each(?) WHERE ${field('id')}=documents.id),
      live_revision_id=(SELECT ${field('revision')}
      FROM json_each(?) WHERE ${field('id')}=documents.id),live_generation=1
      WHERE id IN (SELECT ${field('id')} FROM json_each(?))`,
      )
      .bind(batch, batch, batch),
    db
      .prepare(
        `INSERT INTO published_documents(document_id,revision_id,path,kind,title,description,document_locale,
      plain_text,cjk_bigrams,published_at,updated_at,searchable)

      SELECT ${field('id')},${field('revision')},${field('path')},'article',${field('title')},'','en',${field('text')},
      ${field('han')},1,1,${field('searchable')}
      FROM json_each(?)`,
      )
      .bind(batch),
  ])
}
async function measure(context: Runtime, count: number) {
  const samples = []
  for (const query of [
    'token1234',
    'ｔｏｋｅｎ１２３４',
    '中文搜索',
    '中',
    '原生数据',
    '文中',
    'OR*:"',
  ]) {
    const start = performance.now()
    const response = await context.fetch(`/api/search?q=${encodeURIComponent(query)}`)
    equal(response.status, 200)
    const result = searchResults.parse(await response.json())
    samples.push({
      query,
      elapsedMs: performance.now() - start,
      results: result.items.length,
    })
    assert.ok(result.items.length <= 20)
    if (query === '文中' || query === 'OR*:"') {
      equal(result.items.length, 0)
    }
    if (query.includes('1234') || query.includes('１２３４')) {
      equal(result.items[0]?.path, '/posts/scale-1234')
      equal(result.items.length, 1)
    }
  }
  const noindex = searchResults.parse(await (await context.fetch('/api/search?q=token97')).json())
  equal(noindex.items.length, 0)
  const last = searchResults.parse(await (await context.fetch('/api/search?q=中文搜索&offset=180')).json())
  equal(last.items.length, 20)
  equal(last.nextOffset, null)
  equal((await context.fetch('/api/search?q=中文搜索&offset=200')).status, 400)
  const published = await context.db.prepare('SELECT COUNT(*) AS n FROM published_documents').first<{ n: number }>()
  assert.ok(published !== null)
  equal(
    published.n,
    count,
  )
  return {
    count,
    method:
      'Native canonical rows and normal projection/FTS triggers; real built-Worker HTTP',
    samples,
  }
}
test('10k and 50k native published rows preserve bounded lexical and Han search', async () => {
  const context = await runtime()
  try {
    const template = await templates()
    const reports = []
    for (const count of [10000, 50000]) {
      const start = count === 10000 ? 1 : 10001
      for (let offset = start; offset <= count; offset += 250) {
        await seed(context.db, rows(offset, Math.min(count + 1, offset + 250), template))
      }
      reports.push(await measure(context, count))
      await checkSitemaps(context)
    }
    equal(
      (await context.db.prepare('PRAGMA foreign_key_check').all()).results.length,
      0,
    )
    process.stdout.write(`Search scale measurements: ${JSON.stringify(reports)}\n`)
  }
  finally {
    await context.dispose()
  }
}).catch((error: unknown) => { throw error })

async function checkSitemaps(context: Runtime) {
  const response = await context.fetch('/sitemap.xml')
  equal(response.status, 200)
  const index = await response.text()
  assert.ok(index.includes('<sitemapindex'))
  const child = await context.fetch('/sitemaps/0.xml')
  equal(child.status, 200)
  const xml = await child.text()
  equal((xml.match(/<url>/g) ?? []).length, 1001)
  assert.ok(!xml.includes('/posts/scale-97</loc>'))
  equal((await context.fetch('/sitemaps/99999.xml')).status, 404)
}
