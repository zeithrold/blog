type ReferenceBlock<T> = { type: string, children: T[] }

function* body<T extends ReferenceBlock<T>>(blocks: T[]): Generator<T> {
  for (const block of blocks) {
    if (block.type !== 'footnote') {
      yield block
      yield* body(block.children)
    }
  }
}

export function referenceOrder<T extends ReferenceBlock<T>>(blocks: T[], footnotes: T[]): T[] {
  return [
    ...body(blocks),
    ...footnotes.flatMap(note => [
      note,
      ...body(note.children),
    ]),
  ]
}
