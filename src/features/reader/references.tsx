import type { ReactNode } from 'react'
import type { ReaderContext } from '@/features/reader/context'
import { Blocks } from '@/features/reader/blocks'
import { Inlines } from '@/features/reader/inlines'
import { FootnoteReturn, ReferenceSection } from '@/features/reader/reference-labels'

export function Notes({ context }: { context: ReaderContext }): ReactNode {
  if (context.footnotes.length === 0) {
    return null
  }
  return (
    <ReferenceSection name="footnotes">
      <ol>
        {context.footnotes.map(note => (
          <li key={note.id} id={`note-${note.id}`} value={context.notes.get(note.id)}>
            {Array.isArray(note.content) && (
              <Inlines items={note.content} context={context} blockId={note.id} />
            )}
            <Blocks blocks={note.children} context={context} />
            {context.noteReturns.has(note.id) && (
              <FootnoteReturn
                anchor={context.noteReturns.get(note.id) ?? ''}
                number={context.notes.get(note.id) ?? 0}
              />
            )}
          </li>
        ))}
      </ol>
    </ReferenceSection>
  )
}
export function Bibliography({ context }: { context: ReaderContext }): ReactNode {
  const refs = context.document.references.toSorted(
    (a, b) => (context.citations.get(a.id) ?? 0) - (context.citations.get(b.id) ?? 0),
  )
  if (refs.length === 0) {
    return null
  }
  return (
    <ReferenceSection name="references">
      <ol>
        {refs.map(ref => (
          <li key={ref.id} id={`reference-${ref.id}`} value={context.citations.get(ref.id)}>
            {ref.authors.join(', ')}
            {ref.year !== null ? ` (${ref.year}). ` : '. '}
            {ref.url !== ''
              ? (
                  <a href={ref.url} rel="noopener noreferrer">
                    {ref.title}
                  </a>
                )
              : (
                  ref.title
                )}
            {ref.doi !== '' && (
              <>
                .
                <a href={`https://doi.org/${encodeURIComponent(ref.doi)}`} rel="noopener noreferrer">
                  {ref.doi}
                </a>
              </>
            )}
          </li>
        ))}
      </ol>
    </ReferenceSection>
  )
}
