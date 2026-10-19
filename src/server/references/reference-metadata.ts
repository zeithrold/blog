import type { ReferenceMetadata } from '@/content/reference-metadata'
import { z } from 'zod'
import { normalizeDoi, referenceMetadataSchema } from '@/content/reference-metadata'
import { Problem } from '@/server/http/problem'

const person = z.object({
  given: z.string().optional(),
  family: z.string().optional(),
  name: z.string().optional(),
})
const date = z.object({ 'date-parts': z.array(z.array(z.number())).optional() }).optional()
const crossrefSchema = z.object({ message: z.object({
  'DOI': z.string(),
  'title': z.array(z.string()).optional(),
  'author': z.array(person).optional(),
  'published': date,
  'published-print': date,
  'published-online': date,
  'issued': date,
}) })
const dataCiteSchema = z.object({ data: z.object({ attributes: z.object({
  doi: z.string(),
  titles: z.array(z.object({ title: z.string(), titleType: z.string().optional() })).optional(),
  creators: z.array(z.object({
    name: z.string().optional(),
    givenName: z.string().optional(),
    familyName: z.string().optional(),
  })).optional(),
  publicationYear: z.number().optional(),
}) }) })

export async function referenceMetadata(input: string, fetcher: typeof fetch = fetch): Promise<ReferenceMetadata> {
  const doi = normalizeDoi(input)
  if (doi === null) {
    throw new Problem(400, 'DOI_INVALID')
  }
  const crossref = await metadataRequest(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, fetcher)
  if (crossref !== null) {
    return fromCrossref(crossref, doi)
  }
  const dataCite = await metadataRequest(`https://api.datacite.org/dois/${encodeURIComponent(doi)}`, fetcher)
  if (dataCite === null) {
    throw new Problem(404, 'DOI_NOT_FOUND')
  }
  return fromDataCite(dataCite, doi)
}

function fromCrossref(payload: unknown, doi: string): ReferenceMetadata {
  const parsed = crossrefSchema.safeParse(payload)
  if (!parsed.success || parsed.data.message.DOI.toLowerCase() !== doi.toLowerCase()) {
    throw new Problem(502, 'DOI_METADATA_INVALID')
  }
  const item = parsed.data.message
  const year = [
    item.published,
    item['published-print'],
    item['published-online'],
    item.issued,
  ]
    .map(value => value?.['date-parts']?.[0]?.[0])
    .find(validYear) ?? null
  const authors = item.author?.map(author =>
    author.name ?? [author.given, author.family].filter(value => value !== undefined).join(' '),
  ) ?? []
  return result({ doi, source: 'Crossref', title: item.title?.[0] ?? '', authors, year })
}

function fromDataCite(payload: unknown, doi: string): ReferenceMetadata {
  const parsed = dataCiteSchema.safeParse(payload)
  if (!parsed.success || parsed.data.data.attributes.doi.toLowerCase() !== doi.toLowerCase()) {
    throw new Problem(502, 'DOI_METADATA_INVALID')
  }
  const item = parsed.data.data.attributes
  const title = primaryTitle(item.titles ?? [])
  const authors = item.creators?.map(author =>
    author.name ?? [author.givenName, author.familyName].filter(value => value !== undefined).join(' '),
  ) ?? []
  return result({
    doi,
    source: 'DataCite',
    title,
    authors,
    year: validYear(item.publicationYear) ? item.publicationYear : null,
  })
}

function primaryTitle(titles: { title: string, titleType?: string }[]): string {
  return titles.find(value => value.titleType === undefined)?.title ?? titles[0]?.title ?? ''
}

function validYear(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 9999
}
function result({ doi, source, title, authors, year }: Omit<ReferenceMetadata, 'url'>): ReferenceMetadata {
  const clean = (value: string, limit: number): string => value.replace(/<[^>]*>/g, '').trim().slice(0, limit)
  const url = `https://doi.org/${doi.split('/').map(encodeURIComponent).join('/')}`
  return referenceMetadataSchema.parse({
    doi,
    source,
    title: clean(title, 500),
    authors: authors.map(author => clean(author, 200)).filter(Boolean).slice(0, 50),
    year,
    url: url.length <= 2048 ? url : '',
  })
}

async function metadataRequest(url: string, fetcher: typeof fetch): Promise<unknown> {
  try {
    const response = await fetcher(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'zeithrold-blog/1.0 (DOI metadata lookup)' },
      redirect: 'manual',
      signal: AbortSignal.timeout(8000),
    })
    if (response.status === 404) {
      await response.body?.cancel()
      return null
    }
    if (!response.ok) {
      await response.body?.cancel()
      throw new Problem(503, 'DOI_LOOKUP_UNAVAILABLE')
    }
    return await boundedMetadata(response)
  }
  catch (error) {
    if (error instanceof Problem) {
      throw error
    }
    throw new Problem(503, 'DOI_LOOKUP_UNAVAILABLE')
  }
}
async function boundedMetadata(response: Response): Promise<unknown> {
  if (response.headers.get('content-type')?.includes('json') !== true || response.body === null) {
    throw new Problem(502, 'DOI_METADATA_INVALID')
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let source = ''
  let bytes = 0
  try {
    for (;;) {
      const next = await reader.read()
      if (next.done) {
        break
      }
      bytes += next.value.byteLength
      if (bytes > 262144) {
        await reader.cancel()
        throw new Problem(502, 'DOI_METADATA_INVALID')
      }
      source += decoder.decode(next.value, { stream: true })
    }
    return JSON.parse(source + decoder.decode()) as unknown
  }
  catch (error) {
    if (error instanceof Problem) {
      throw error
    }
    throw new Problem(502, 'DOI_METADATA_INVALID')
  }
  finally {
    reader.releaseLock()
  }
}
