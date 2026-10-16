import { emptyDocument } from '@/content/document'

export function fixture(body: string): ReturnType<typeof emptyDocument> {
  const document = emptyDocument()
  document.meta.title = 'A draft title that stays readable on a narrow screen'
  document.meta.slug = `preview-history-${crypto.randomUUID()}`
  const paragraph = document.blocks[0]
  if (paragraph === undefined) {
    throw new Error('The fixture has no initial paragraph')
  }
  paragraph.content = [
    { type: 'text', text: body, styles: {} },
  ]
  return document
}
