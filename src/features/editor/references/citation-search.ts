import type { Document } from '@/content/document'

type Reference = Document['references'][number]

function searchText(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('en')
}

/** A reference key, author or title may supply each word of the query. */
export function matchingReferences(references: readonly Reference[], query: string): Reference[] {
  const terms = searchText(query).trim().split(/\s+/u).filter(Boolean)
  return references.filter((reference) => {
    const text = searchText([
      reference.id,
      reference.title,
      ...reference.authors,
    ].join(' '))
    return terms.every(term => text.includes(term))
  })
}
