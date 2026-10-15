import { z } from 'zod'

export const publicationIssue = z.enum([
  'title',
  'slug',
  'media',
  'image',
  'transcript',
  'table',
  'citation',
  'footnote',
  'diagram',
  'mediaSource',
])
export type PublicationIssue = z.infer<typeof publicationIssue>
export const publicationIssueList = z.array(publicationIssue).max(10)
