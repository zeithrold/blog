import type { Page } from '@playwright/test'
import type { Block, BlockType, Document, Inline } from '@/content/document'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { BLOCK_TYPES, emptyDocument, validateDocument } from '@/content/document'
import { assetAllocationSchema, assetDescriptorSchema } from '@/contracts/media'
import { sessionSchema } from '@/contracts/session'
import { expect } from '~/tests/support/browser/test'

export const textProps = { textAlignment: 'left', textColor: 'default', backgroundColor: 'default' } as const
export function inline(text: string): Inline[] {
  return [
    { type: 'text', text, styles: {} },
  ]
}
export function textBlock(
  type: BlockType,
  text: string,
  props: Record<string, string | number | boolean> = textProps,
): Block {
  return { id: crypto.randomUUID(), type, props, content: inline(text), children: [] }
}

export const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGMQCej5DwADXAHwCt6haAAAAABJRU5ErkJggg==',
  'base64',
)

type AssetInput = { role: 'image' | 'audio' | 'video' | 'file', type: string, filename: string, data: Buffer }

async function asset(page: Page, input: AssetInput) {
  const { role, type, filename, data } = input
  const session = sessionSchema.parse(await (await page.request.get('/api/admin/session')).json())
  const headers = { 'origin': new URL(page.url()).origin, 'x-csrf-token': session.csrfToken }
  const allocated = await page.request.post('/api/admin/assets', {
    headers: { ...headers, 'idempotency-key': crypto.randomUUID() },
    data: { role, type, filename, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') },
  })
  expect(allocated.status(), await allocated.text()).toBe(201)
  const allocation = assetAllocationSchema.parse(await allocated.json())
  const uploaded = await page.request.put(allocation.uploadPath, {
    headers: { ...headers, 'content-type': type },
    data,
  })
  expect(uploaded.status(), await uploaded.text()).toBe(200)
  return assetDescriptorSchema.parse(await uploaded.json())
}

function wave(): Buffer {
  const data = Buffer.alloc(1644)
  data.write('RIFF', 0)
  data.writeUInt32LE(data.length - 8, 4)
  data.write('WAVEfmt ', 8)
  data.writeUInt32LE(16, 16)
  data.writeUInt16LE(1, 20)
  data.writeUInt16LE(1, 22)
  data.writeUInt32LE(8000, 24)
  data.writeUInt32LE(16000, 28)
  data.writeUInt16LE(2, 32)
  data.writeUInt16LE(16, 34)
  data.write('data', 36)
  data.writeUInt32LE(data.length - 44, 40)
  return data
}

function coreDocument(): Document {
  const document = emptyDocument()
  document.meta.title = 'Journey mixed content'
  document.meta.slug = 'journey-mixed'
  const note = textBlock('footnote', 'Journey footnote', {})
  const ref = { id: crypto.randomUUID(), title: 'Journey source', authors: [
    'Ada Lovelace',
  ], year: 2026, doi: '', url: '' }
  document.references = [ref]
  const paragraph = referenceParagraph(note.id, ref.id)
  const table = comparisonTable()
  const toggle = textBlock('toggleListItem', 'Journey details')
  toggle.children = [
    textBlock('paragraph', 'Journey nested paragraph'),
  ]
  document.blocks = [
    paragraph,
    { ...textBlock('heading', 'Journey heading'), props: { ...textProps, level: 2 } },
    textBlock('bulletListItem', 'Journey bullet'),
    textBlock('numberedListItem', 'Journey number'),
    { ...textBlock('checkListItem', 'Journey checklist'), props: { ...textProps, checked: false } },
    toggle,
    textBlock('quote', 'Journey quote', { textColor: 'default', backgroundColor: 'default' }),
    textBlock('codeBlock', 'const journey = true', { language: 'typescript' }),
    { id: crypto.randomUUID(), type: 'divider', props: {}, children: [] },
    table,
    textBlock('callout', 'Journey callout', { tone: 'info' }),
    note,
    textBlock('math', 'x^2+y^2=z^2', {}),
    textBlock('mermaid', 'graph TD\nA-->B', { description: 'Journey diagram' }),
    { id: crypto.randomUUID(), type: 'toc', props: { title: 'Journey contents' }, children: [] },
    { id: crypto.randomUUID(), type: 'linkCard', props: {
      url: 'https://example.com',
      title: 'Journey card',
      description: 'A deliberate link',
    }, children: [] },
    { id: crypto.randomUUID(), type: 'embed', props: {
      provider: 'youtube',
      videoId: 'dQw4w9WgXcQ',
      title: 'Journey consent video',
    }, children: [] },
  ]
  document.tableAccessibility[table.id] = { caption: 'Journey table caption' }
  return document
}

async function addMedia(page: Page, document: Document): Promise<void> {
  const video = await readFile(new URL('../fixtures/media-context-video.mp4', import.meta.url))
  for (const [role, type, filename, bytes] of [
    [
      'image',
      'image/png',
      'journey.png',
      png,
    ],
    [
      'audio',
      'audio/wav',
      'journey.wav',
      wave(),
    ],
    [
      'video',
      'video/mp4',
      'journey.mp4',
      video,
    ],
    [
      'file',
      'text/plain',
      'journey.txt',
      Buffer.from('Journey downloadable file'),
    ],
  ] as const) {
    const ready = await asset(page, { role, type, filename, data: bytes })
    const block: Block = { id: crypto.randomUUID(), type: role, props: {
      backgroundColor: 'default',
      name: filename,
      url: ready.url,
      caption: 'Journey media',
      ...(role !== 'file' ? { showPreview: true } : {}),
      ...(role === 'image' || role === 'video' ? { textAlignment: 'left', previewWidth: 240 } : {}),
    }, children: [] }
    document.blocks.push(block)
    document.mediaAccessibility[block.id] = {
      alt: 'Journey image description',
      decorative: false,
      transcript: 'Journey spoken content',
      captionAssetId: null,
      posterAssetId: null,
    }
  }
}

export async function mixedDocument(page: Page): Promise<Document> {
  await page.goto('/__fixture/login')
  const document = coreDocument()
  await addMedia(page, document)
  expect(new Set(document.blocks.map(block => block.type))).toEqual(new Set(BLOCK_TYPES))
  return validateDocument(document)
}

function referenceParagraph(noteId: string, referenceId: string): Block {
  const paragraph = textBlock('paragraph', 'Journey anchor')
  paragraph.content = [
    ...inline('Journey anchor '),
    { type: 'text', text: 'bold ', styles: { bold: true } },
    { type: 'text', text: 'italic ', styles: { italic: true } },
    { type: 'text', text: 'underline ', styles: { underline: true } },
    { type: 'text', text: 'strike ', styles: { strike: true } },
    { type: 'text', text: 'code ', styles: { code: true } },
    { type: 'text', text: 'colored ', styles: { textColor: 'red' } },
    { type: 'text', text: 'highlighted ', styles: { backgroundColor: 'yellow' } },
    { type: 'link', href: 'https://example.com', content: [
      { type: 'text', text: 'Journey link', styles: {} },
    ] },
    { type: 'citation', props: { referenceId, locator: 'p. 1' } },
    { type: 'footnoteRef', props: { noteId } },
    { type: 'inlineMath', props: { source: 'a^2' } },
  ]
  return paragraph
}

function comparisonTable(): Block {
  const table: Block = {
    id: crypto.randomUUID(),
    type: 'table',
    props: { textColor: 'default' },
    children: [],
    content: { type: 'tableContent', columnWidths: [180, 180], headerRows: 1, rows: [
      { cells: [
        tableCell('Journey cell'),
        tableCell('Value'),
      ] },
      { cells: [
        tableCell('Second row'),
        tableCell('42'),
      ] },
    ] },
  }
  return table
}

function tableCell(text: string) {
  return {
    type: 'tableCell' as const,
    props: { ...textProps, colspan: 1, rowspan: 1 },
    content: inline(text),
  }
}
