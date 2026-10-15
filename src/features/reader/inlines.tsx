import type { ReactNode } from 'react'
import type { Inline, Styles } from '@/content/document'
import type { ReaderContext } from '@/features/reader/context'
import { stableJSON } from '@/content/canonical'
import { MathView } from '@/features/reader/math'

function StyledText({ text, styles }: { text: string, styles: Styles }): ReactNode {
  let result: ReactNode = text
  if (styles.code === true) {
    result = <code>{result}</code>
  }
  if (styles.bold === true) {
    result = <strong>{result}</strong>
  }
  if (styles.italic === true) {
    result = <em>{result}</em>
  }
  if (styles.underline === true) {
    result = <u>{result}</u>
  }
  if (styles.strike === true) {
    result = <s>{result}</s>
  }
  return (
    <span
      className="native-text whitespace-pre-wrap"
      data-text-color={styles.textColor}
      data-background-color={styles.backgroundColor}
    >
      {result}
    </span>
  )
}
function InlineView({
  item,
  context,
  anchor,
}: {
  item: Inline
  context: ReaderContext
  anchor: string
}): ReactNode {
  if (item.type === 'text') {
    return <StyledText text={item.text} styles={item.styles} />
  }
  if (item.type === 'link') {
    return (
      <a href={item.href} rel="noopener noreferrer">
        <Inlines items={item.content} context={context} blockId={anchor} />
      </a>
    )
  }
  if (item.type === 'inlineMath') {
    return <MathView source={item.props.source} />
  }
  if (item.type === 'citation') {
    const number = context.citations.get(item.props.referenceId)
    return (
      <a href={`#reference-${item.props.referenceId}`} aria-label={`Reference ${number ?? 'missing'}`}>
        [
        {number ?? '?'}
        {item.props.locator !== '' ? `, ${item.props.locator}` : ''}
        ]
      </a>
    )
  }
  const number = context.notes.get(item.props.noteId)
  return (
    <sup id={anchor}>
      <a href={`#note-${item.props.noteId}`} aria-label={`Footnote ${number ?? 'missing'}`}>
        {number ?? '?'}
      </a>
    </sup>
  )
}
export function Inlines({
  items,
  context,
  blockId,
  offset = 0,
}: {
  items: Inline[]
  context: ReaderContext
  blockId: string
  offset?: number
}): ReactNode {
  const seen = new Map<string, number>()
  return items.map((item, position) => {
    const signature = stableJSON(item).slice(0, 100)
    const occurrence = seen.get(signature) ?? 0
    seen.set(signature, occurrence + 1)
    return (
      <InlineView
        key={`${signature}:${occurrence}`}
        item={item}
        context={context}
        anchor={`note-ref-${blockId}-${offset + position}`}
      />
    )
  })
}
