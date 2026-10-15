import assert from 'node:assert/strict'
import { test } from 'node:test'
import { runtime } from './runtime.mjs'

void test('DOI lookup authenticates the owner, maps upstream metadata and never writes a document', async () => {
  let requests = 0
  const context = await runtime('http://127.0.0.1:8800', async (request) => {
    requests++
    assert.equal(request.url, 'https://api.crossref.org/works/10.1234%2Fexample')
    return Response.json({ message: { DOI: '10.1234/example', title: ['A retrieved article'], author: [
      { given: 'Ada', family: 'Lovelace' },
    ], published: { 'date-parts': [
      [2026],
    ] } } })
  })
  try {
    const anonymous = await context.fixture.dispatchFetch(
      `${context.origin}/api/admin/reference-metadata?doi=10.1234/example`,
    )
    assert.equal(anonymous.status, 401)
    assert.equal(requests, 0)
    const invalid = await context.fetch('/api/admin/reference-metadata?doi=https://evil.example/')
    assert.equal(invalid.status, 400)
    assert.equal((await invalid.json()).code, 'DOI_INVALID')
    assert.equal(requests, 0)
    const before = await (await context.fetch('/api/admin/documents')).json()
    const response = await context.fetch('/api/admin/reference-metadata?doi=10.1234/example')
    assert.equal(response.status, 200, await response.clone().text())
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.deepEqual(await response.json(), { doi: '10.1234/example', title: 'A retrieved article', authors: [
      'Ada Lovelace',
    ], year: 2026, url: 'https://doi.org/10.1234/example', source: 'Crossref' })
    assert.equal(requests, 1)
    assert.deepEqual(await (await context.fetch('/api/admin/documents')).json(), before)
  }
  finally {
    await context.dispose()
  }
})
