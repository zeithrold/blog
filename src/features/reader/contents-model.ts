type ContentsBlock = {
  id: string
  type: string
  props: Record<string, unknown>
  content?: unknown
  children?: readonly ContentsBlock[]
}
export type ContentsHeading = { id: string, level: number, text: string }

function inlineText(content: unknown): string {
  if (!Array.isArray(content)) {
    return ''
  }
  return content.map((item: unknown) => {
    if (item === null || typeof item !== 'object') {
      return ''
    }
    const text: unknown = Reflect.get(item, 'text')
    return typeof text === 'string' ? text : inlineText(Reflect.get(item, 'content'))
  }).join('')
}

export function contentsHeadings(blocks: readonly ContentsBlock[]): ContentsHeading[] {
  const headings: ContentsHeading[] = []
  const walk = (items: readonly ContentsBlock[]): void => {
    for (const block of items) {
      if (block.type === 'footnote') {
        continue
      }
      const text = inlineText(block.content).trim()
      if (block.type === 'heading' && text !== '') {
        const level = Number(block.props.level)
        headings.push({ id: block.id, level: Math.min(3, Math.max(1, Number.isFinite(level) ? level : 1)), text })
      }
      walk(block.children ?? [])
    }
  }
  walk(blocks)
  return headings
}
