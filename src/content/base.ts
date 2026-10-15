import type { PublicationIssue } from '@/content/publication-issues'
import { z } from 'zod'

z.config({
  jitless: true,
})
export const UUID = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
export const SLUG = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9][a-z0-9-]{0,119}$/)
export const MAX_DOCUMENT_BYTES = 524288
export const COLORS = [
  'default',
  'gray',
  'brown',
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'pink',
] as const
export const color = z.enum(COLORS)
export function safeURL(value: string): boolean {
  if (
    !(value !== '')
    || /[\s\p{Cc}\\]/u.test(value)
    || /%(?:0[ad]|5c)/i.test(value)
    || value.startsWith('//')
  ) {
    return false
  }
  if (value.startsWith('/') || value.startsWith('#')) {
    return true
  }
  try {
    const url = new URL(value)
    return (
      [
        'https:',
        'http:',
        'mailto:',
      ].includes(url.protocol)
      && !(url.username !== '')
      && !(url.password !== '')
    )
  }
  catch {
    return false
  }
}
export class ContentError extends Error {
  constructor(
    public code = 'INVALID_DOCUMENT',
    public status = 422,
    public issues: PublicationIssue[] = [],
  ) {
    super(code)
  }
}
export function requireContent(ok: boolean): asserts ok {
  if (!ok) {
    throw new ContentError()
  }
}
// The envelope contract measures string bounds in JavaScript UTF-16 units.
export function boundedString(maximum: number): z.ZodString {
  return z.string().refine(value => value.length <= maximum)
}
