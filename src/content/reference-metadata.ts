import { z } from 'zod'
import { boundedString, safeURL } from '@/content/base'

export const doiSchema = boundedString(2048).regex(/^10\.\d{4,9}\/[^\s\p{Cc}\\]+$/u)
export const referenceMetadataSchema = z.strictObject({
  doi: doiSchema,
  title: boundedString(500),
  authors: z.array(boundedString(200).min(1)).max(50),
  year: z.number().int().min(1).max(9999).nullable(),
  url: z.union([
    z.literal(''),
    boundedString(2048).refine(safeURL),
  ]),
  source: z.enum(['Crossref', 'DataCite']),
})
export type ReferenceMetadata = z.infer<typeof referenceMetadataSchema>

export function normalizeDoi(input: string): string | null {
  let value = input.trim().replace(/^doi:\s*/i, '')
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value)
      if (!['doi.org', 'dx.doi.org'].includes(url.hostname) || url.search !== '' || url.hash !== '') {
        return null
      }
      if (url.username !== '' || url.password !== '') {
        return null
      }
      value = decodeURIComponent(url.pathname.slice(1))
    }
    catch {
      return null
    }
  }
  return doiSchema.safeParse(value).success ? value : null
}
