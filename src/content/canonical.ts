import type { Document, Inline } from '@/content/document'
import { ContentError, MAX_DOCUMENT_BYTES, validateDocument } from '@/content/document'

export function stableJSON(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(item => stableJSON(item ?? null)).join(',')}]`
  }
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => {
        if (a === b) {
          return 0
        }
        return a < b ? -1 : 1
      })
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJSON(item)}`)
      .join(',')}}`
  }
  if (value === undefined) {
    return 'null'
  }
  return JSON.stringify(value)
}
function compact<T extends Inline>(items: T[]): T[] {
  const result: T[] = []
  for (const item of items) {
    if (item.type === 'link') {
      item.content = compact(item.content)
    }
    if (item.type === 'text' && item.text === '') {
      continue
    }
    const last = result.at(-1)
    if (
      item.type === 'text'
      && last?.type === 'text'
      && stableJSON(last.styles) === stableJSON(item.styles)
    ) {
      last.text += item.text
    }
    else {
      result.push(item)
    }
  }
  return result
}
export async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join(
    '',
  )
}
export async function canonicalize(input: unknown): Promise<{
  document: Document
  json: string
  hash: string
  bytes: number
}> {
  const document = validateDocument(input)
  function walk(blocks: Document['blocks']): void {
    for (const block of blocks) {
      if (Array.isArray(block.content)) {
        block.content = compact(block.content)
      }
      else if (block.content !== undefined) {
        for (const row of block.content.rows) {
          row.cells = row.cells.map(cell =>
            Array.isArray(cell)
              ? compact(cell)
              : {
                  ...cell,
                  content: compact(cell.content),
                },
          )
        }
      }
      walk(block.children)
    }
  }
  walk(document.blocks)
  const json = stableJSON(document)
  const bytes = new TextEncoder().encode(json).byteLength
  if (bytes > MAX_DOCUMENT_BYTES) {
    throw new ContentError('DOCUMENT_TOO_LARGE', 413)
  }
  return {
    document,
    json,
    hash: await sha256(json),
    bytes,
  }
}
export { extractText } from '@/content/text'
export function hanTokens(text: string): string {
  const tokens = new Set<string>()
  for (const run of text.normalize('NFKC').match(/\p{Script=Han}+/gu) ?? []) {
    const chars = Array.from(run)
    chars.forEach((char, i) => {
      tokens.add(char)
      const next = chars[i + 1]
      if (next !== undefined) {
        tokens.add(char + next)
      }
    })
  }
  return Array.from(tokens).join(' ')
}
