import { afterEach, expect, it } from 'vitest'
import { one } from './dom'
import { citedTableDocument } from './references-stub'
import {
  mountReferences,
  openReferenceList,
  resetReferences,
} from './references-support'

afterEach(resetReferences)

for (const structured of [false, true]) {
  const encoding = structured ? 'structured tableCell nodes' : 'array table cells'
  it(`keeps a reference cited by ${encoding} disabled`, () => {
    const view = mountReferences({
      initial: citedTableDocument(structured),
      handlers: {},
    })
    openReferenceList(view)
    const row = one(view.container, '.reference-item')
    const remove = Array.from(row.querySelectorAll<HTMLButtonElement>('button'))
      .find(candidate => candidate.getAttribute('aria-label')?.startsWith('Remove reference') === true)
    if (remove === undefined) {
      throw new Error(`The cited reference row has no remove action: ${row.innerHTML}`)
    }
    expect(remove.getAttribute('aria-label')).toBe('Remove reference: Cited in a table')
    expect(remove.disabled).toBe(true)
    expect(remove.getAttribute('title'))
      .toBe('Remove citations from the body before removing this reference.')
    expect(row.textContent).toContain('Remove citations from the body before removing this reference.')
    expect(view.api.calls).toEqual([])
    expect(view.api.unhandled).toEqual([])
  })
}
