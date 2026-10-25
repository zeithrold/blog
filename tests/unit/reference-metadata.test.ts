import assert from 'node:assert/strict'
import { test } from 'node:test'
import { envelope } from '@/content/envelope'
import { normalizeDoi } from '@/content/reference-metadata'
import { fillEmptyFields } from '@/features/editor/references/reference-form'
import { Problem } from '@/server/http/problem'
import { referenceMetadata } from '@/server/references/reference-metadata'
import { deepEqual, equal } from '~/tests/support/unit/assertions'

const doi = '10.1234/example'
const crossref = { message: { DOI: doi, title: ['<i>A useful reference</i>'], author: [
  { given: 'Ada', family: 'Lovelace' },
  { name: 'Research Group' },
], published: { 'date-parts': [
  [
    2026,
    1,
    1,
  ],
] }, issued: { 'date-parts': [
  [2025],
] } } }

function failure(code: string): (error: unknown) => boolean {
  return error => error instanceof Problem && error.code === code
}

test('DOI input accepts bare values, labels and resolver links without accepting arbitrary URLs', () => {
  for (const input of [
    doi,
    ` doi: ${doi} `,
    `https://doi.org/${doi}`,
    'http://dx.doi.org/10.1234%2Fexample',
  ]) {
    equal(normalizeDoi(input), doi)
  }
  for (const input of [
    'https://example.com/10.1234/example',
    'https://doi.org.evil/10.1234/example',
    'https://user@doi.org/10.1234/example',
    'https://doi.org/10.1234/example?secret=x',
    '10.1234/a\nname',
    '10.1234/\\evil',
    '10.1234/\u0000',
    '10.1234/',
    'invalid',
  ]) {
    equal(normalizeDoi(input), null)
  }
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})

test('Crossref metadata maps names and publication date while only contacting the fixed endpoint', async () => {
  const fetcher: typeof fetch = async (input, init) => {
    equal(input, 'https://api.crossref.org/works/10.1234%2Fexample')
    equal(init?.redirect, 'manual')
    assert.ok(init?.signal instanceof AbortSignal)
    return await Promise.resolve(Response.json(crossref))
  }
  deepEqual(await referenceMetadata(`https://doi.org/${doi}`, fetcher), {
    doi,
    title: 'A useful reference',
    authors: ['Ada Lovelace', 'Research Group'],
    year: 2026,
    url: `https://doi.org/${doi}`,
    source: 'Crossref',
  })
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})

test('Crossref not-found falls back to DataCite with its primary title and institutional creators', async () => {
  const fetcher: typeof fetch = async (input) => {
    if (input === 'https://api.crossref.org/works/10.1234%2Fexample') {
      return await Promise.resolve(new Response('', { status: 404 }))
    }
    equal(input, 'https://api.datacite.org/dois/10.1234%2Fexample')
    return await Promise.resolve(Response.json({ data: { attributes: { doi, titles: [
      { title: 'Alternate', titleType: 'AlternativeTitle' },
      { title: 'Dataset' },
    ], creators: [
      { name: 'A Research Institute' },
    ], publicationYear: 2020 } } }))
  }
  const result = await referenceMetadata(doi, fetcher)
  equal(result.source, 'DataCite')
  equal(result.title, 'Dataset')
  deepEqual(result.authors, ['A Research Institute'])
  equal(result.year, 2020)
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})

function stub(response: Response): typeof fetch {
  return async () => await Promise.resolve(response)
}

test('invalid, absent and unavailable DOIs have distinct errors without sending invalid input', async () => {
  await assert.rejects(referenceMetadata('https://127.0.0.1/admin', () => {
    assert.fail('Invalid input must not make a request')
  }), failure('DOI_INVALID'))
  await assert.rejects(referenceMetadata(doi, stub(new Response('', { status: 404 }))), failure('DOI_NOT_FOUND'))
  await assert.rejects(
    referenceMetadata(doi, stub(new Response('', { status: 429 }))),
    failure('DOI_LOOKUP_UNAVAILABLE'),
  )
  await assert.rejects(
    referenceMetadata(doi, async () => await Promise.reject(new Error('Timeout'))),
    failure('DOI_LOOKUP_UNAVAILABLE'),
  )
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})

test('metadata rejects wrong identifiers, invalid JSON, redirects and oversized bodies', async () => {
  const wrong = Response.json({ message: { DOI: '10.1234/other' } })
  const invalid = new Response('{', { headers: { 'content-type': 'application/json' } })
  const oversized = new Response('x'.repeat(262145), { headers: { 'content-type': 'application/json' } })
  await assert.rejects(referenceMetadata(doi, stub(wrong)), failure('DOI_METADATA_INVALID'))
  await assert.rejects(referenceMetadata(doi, stub(invalid)), failure('DOI_METADATA_INVALID'))
  await assert.rejects(
    referenceMetadata(doi, stub(new Response('', { status: 302 }))),
    failure('DOI_LOOKUP_UNAVAILABLE'),
  )
  await assert.rejects(referenceMetadata(doi, stub(oversized)), failure('DOI_METADATA_INVALID'))
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})

test('partial metadata stays usable and lookup preserves edits made while a request was pending', async () => {
  const result = await referenceMetadata(doi, stub(Response.json({ message: { DOI: doi } })))
  equal(result.title, '')
  deepEqual(result.authors, [])
  equal(result.year, null)
  const current = { title: 'My title', authors: [
    { id: 'manual', name: 'My author' },
  ], year: '', url: 'https://my.example', doi }
  const incoming = {
    title: 'Retrieved title',
    authors: [
      { id: 'retrieved', name: 'Retrieved author' },
    ],
    year: '2026',
    url: 'https://doi.org/10.1234/example',
    doi,
  }
  deepEqual(fillEmptyFields(current, incoming), { ...current, year: '2026' })
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})

// The form submits a draft through this schema, so the year rule it enforces is
// the one thing a browser case cannot prove on its own: a fractional value the
// input accepts is still refused, and only a whole year between 1 and 9999 is
// stored.
test('the reference envelope stores a whole year and refuses a fractional or out-of-range one', () => {
  const reference = {
    id: crypto.randomUUID(),
    title: 'A reference',
    authors: ['Author'],
    year: 2026,
    url: '',
    doi: '',
  }
  equal(envelope.shape.references.element.safeParse(reference).success, true)
  equal(envelope.shape.references.element.safeParse({ ...reference, year: null }).success, true)
  for (const year of [
    2026.5,
    0,
    10000,
  ]) {
    const result = envelope.shape.references.element.safeParse({ ...reference, year })
    equal(result.success, false, `year ${year} must be refused`)
    deepEqual(result.success ? [] : result.error.issues.map(issue => issue.path), [
      ['year'],
    ])
  }
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})
