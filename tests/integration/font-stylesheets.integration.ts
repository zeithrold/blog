import assert from 'node:assert/strict'
import { test } from 'node:test'
import { runtime } from '~/tests/support/worker/runtime'

test('built HTML loads Sans and Serif font stylesheets once in the head', async (t) => {
  const app = await runtime()
  t.after(async () => await app.dispose())
  const response = await app.fetch('/')
  assert.equal(response.status, 200)
  const html = await response.text()
  const head = /<head[^>]*>([\s\S]*?)<\/head>/u.exec(html)?.[1] ?? ''
  const links = Array.from(head.matchAll(/<link\b[^>]*>/gu), match => match[0])
    .filter(link => link.includes('https://fonts.googleapis.com/') && /rel="stylesheet"/u.test(link))
  assert.equal(links.length, 2)
  const urls = links.map((link) => {
    assert.match(link, /rel="stylesheet"/u)
    const href = /href="([^"]+)"/u.exec(link)?.[1]
    assert.ok(href !== undefined)
    return new URL(href.replaceAll('&amp;', '&'))
  })
  const families = urls.flatMap(url => url.searchParams.getAll('family'))
  for (const family of [
    'Noto Sans:wght@400..700',
    'Noto Serif:wght@400..700',
    'Noto Color Emoji',
  ]) {
    assert.equal(families.filter(value => value === family).length, 1)
  }
  for (const font of ['Sans', 'Serif']) {
    for (const language of [
      'SC',
      'JP',
      'KR',
    ]) {
      assert.ok(families.includes(`Noto ${font} ${language}:wght@400..700`))
    }
  }
  assert.ok(urls.every(url => url.searchParams.get('display') === 'swap'))
}).catch((error: unknown) => {
  throw error
})
