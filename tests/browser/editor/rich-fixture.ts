import type { Document } from '@/content/document'
import { emptyDocument } from '@/content/document'

export function richDocument(): Document {
  const document = emptyDocument()
  const referenceId = crypto.randomUUID()
  const noteId = crypto.randomUUID()
  document.meta.title = 'Rich browser document'
  document.meta.slug = `rich-browser-${crypto.randomUUID()}`
  document.references = [
    {
      id: referenceId,
      title: 'Source book',
      authors: ['Author'],
      year: 2026,
      url: 'https://example.com',
      doi: '',
    },
    {
      id: crypto.randomUUID(),
      title: 'Other source',
      authors: ['Researcher'],
      year: 2025,
      url: '',
      doi: '',
    },
  ]
  const first = document.blocks[0]
  if (first === undefined) {
    throw new Error('Missing paragraph')
  }
  first.content = [
    { type: 'text', text: 'Native references ', styles: {} },
    { type: 'citation', props: { referenceId, locator: 'p. 3' } },
    { type: 'footnoteRef', props: { noteId } },
    { type: 'inlineMath', props: { source: 'x^2' } },
  ]
  addBlocks(document, noteId)
  return document
}
function addBlocks(document: Document, noteId: string): void {
  document.blocks.push(
    {
      id: crypto.randomUUID(),
      type: 'heading',
      props: {
        textAlignment: 'left',
        textColor: 'default',
        backgroundColor: 'default',
        level: 2,
      },
      content: [
        { type: 'text', text: 'Rich section', styles: {} },
      ],
      children: [],
    },
    {
      id: crypto.randomUUID(),
      type: 'callout',
      props: { tone: 'info' },
      content: [
        { type: 'text', text: 'Native callout', styles: {} },
      ],
      children: [],
    },
    {
      id: noteId,
      type: 'footnote',
      props: {},
      content: [
        { type: 'text', text: 'A native footnote', styles: {} },
      ],
      children: [],
    },
    {
      id: crypto.randomUUID(),
      type: 'math',
      props: {},
      content: [
        { type: 'text', text: 'x^2+y^2=z^2', styles: {} },
      ],
      children: [],
    },
  )
  addInteractiveBlocks(document)
}
function addInteractiveBlocks(document: Document): void {
  document.blocks.push(
    {
      id: crypto.randomUUID(),
      type: 'mermaid',
      props: { description: 'Safe diagram' },
      content: [
        { type: 'text', text: 'graph TD\nA-->B', styles: {} },
      ],
      children: [],
    },
    { id: crypto.randomUUID(), type: 'toc', props: { title: 'Contents' }, children: [] },
    {
      id: crypto.randomUUID(),
      type: 'linkCard',
      props: {
        url: 'https://example.com',
        title: 'Example link',
        description: 'No metadata fetching',
      },
      children: [],
    },
    {
      id: crypto.randomUUID(),
      type: 'embed',
      props: { provider: 'youtube', videoId: 'dQw4w9WgXcQ', title: 'Consent video' },
      children: [],
    },
  )
}
