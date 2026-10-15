import type { Block, Document } from '../../src/content/document'
import { canonicalize, stableJSON } from '../../src/content/canonical'
import { emptyDocument } from '../../src/content/document'

function id(index: number): string {
  return `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`
}
function text(value: string): { type: 'text', text: string, styles: Record<string, never> } {
  return { type: 'text', text: value, styles: {} }
}
function paragraph(index: number): Block {
  return {
    id: id(index),
    type: 'paragraph',
    props: { textAlignment: 'left', textColor: 'default', backgroundColor: 'default' },
    content: [
      text(`P${index} 中文`),
    ],
    children: [],
  }
}
function complexBlocks(document: Document, count: number): void {
  const nested = paragraph(count - 3)
  nested.type = 'bulletListItem'
  nested.children = [
    paragraph(count - 2),
  ]
  const child = nested.children[0]
  if (child === undefined) {
    throw new Error('Missing child')
  }
  child.type = 'bulletListItem'
  child.children = [
    paragraph(count - 1),
  ]
  const root = document.blocks[6]
  if (root === undefined) {
    throw new Error('Missing list')
  }
  root.type = 'bulletListItem'
  root.children = [nested]
  document.blocks[10] = {
    id: id(10),
    type: 'codeBlock',
    props: { language: 'typescript' },
    children: [],
    content: [
      text('const value = 42\n'.repeat(12)),
    ],
  }
  document.blocks[11] = {
    id: id(11),
    type: 'math',
    props: {},
    children: [],
    content: [
      text('x^2 + y^2 = z^2'),
    ],
  }
  document.blocks[12] = {
    id: id(12),
    type: 'mermaid',
    props: { description: 'Simple graph' },
    children: [],
    content: [
      text('graph TD\nA-->B'),
    ],
  }
  tableFixture(document, count)
}
function tableFixture(document: Document, count: number): void {
  const rows = tableRows(count)
  document.blocks[13] = {
    id: id(13),
    type: 'table',
    props: { textColor: 'default' },
    children: [],
    content: {
      type: 'tableContent',
      columnWidths: [
        120,
        120,
        120,
        120,
        120,
        120,
      ],
      headerRows: 1,
      rows: Array.from({ length: rows }, (_, row) => ({
        cells: Array.from({ length: 6 }, (_cell, col) => ({
          type: 'tableCell' as const,
          props: {
            textAlignment: 'left' as const,
            textColor: 'default' as const,
            backgroundColor: 'default' as const,
            colspan: 1,
            rowspan: 1,
          },
          content: [
            text(`Cell ${row}/${col}`),
          ],
        })),
      })),
    },
  }
  document.tableAccessibility[id(13)] = { caption: 'Technical comparison' }
}
export async function fixture(
  count: number,
  targetBytes: number,
): Promise<{ document: Document, bytes: number, hash: string }> {
  const document = emptyDocument()
  document.meta.title = `Performance ${count}`
  document.meta.slug = `performance-${count}`
  document.blocks = Array.from({ length: count - 3 }, (_, index) => paragraph(index))
  complexBlocks(document, count)
  const initial = { bytes: new TextEncoder().encode(stableJSON(document)).byteLength }
  const available = targetBytes - initial.bytes
  if (available < 0) {
    throw new Error(`Fixture overhead ${initial.bytes} exceeds target ${targetBytes}`)
  }
  const plain = document.blocks.filter(block => block.type === 'paragraph')
  const portion = Math.floor(available / plain.length)
  let remainder = available % plain.length
  for (const block of plain) {
    const content = block.content
    if (!Array.isArray(content)) {
      throw new TypeError('Missing paragraph content')
    }
    const first = content[0]
    if (first?.type !== 'text') {
      throw new Error('Missing paragraph text')
    }
    const amount = portion + (remainder-- > 0 ? 1 : 0)
    first.text += ' Technical data and bounded rendering. '
      .repeat(Math.ceil(amount / 38))
      .slice(0, amount)
  }
  const result = await canonicalize(document)
  if (result.bytes !== targetBytes) {
    throw new Error(`Fixture byte mismatch ${result.bytes}`)
  }
  return { document: result.document, bytes: result.bytes, hash: result.hash }
}

function tableRows(count: number): number {
  if (count < 500) {
    return 8
  }
  if (count < 2000) {
    return 32
  }
  return 64
}
