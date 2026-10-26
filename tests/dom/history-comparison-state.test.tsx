import { afterEach, expect, it } from 'vitest'
import { historyCopy } from '~/tests/components/support/history-copy'
import { historyCase, page, readRevision, serveFetch } from './history-page-support'
import { click, pressKey, renderPage, resetDomPage, selectedRevision, visibleText } from './history-state-support'

/**
 * The page's comparison semantics that the browser journey also asserts.
 *
 * Kept beside the guard tail rather than inside the merged selection cases, so the
 * batch manifest and its cases stay untouched.
 */

const copy = historyCopy.en

/** The page's own words for two revisions with nothing between them. */
const sameRevision = 'These revisions contain the same content.'

afterEach(resetDomPage)

it('reports no differences when the baseline is the selected revision', async () => {
  const fixture = historyCase()
  const stub = serveFetch({
    [`GET ${fixture.path}/revisions/${fixture.first.revisionId}`]: () => readRevision(fixture.first),
  })
  const view = renderPage(page(fixture))
  await click(view.button(new RegExp(`^${copy.revision} ${fixture.first.sequence}\\b`)))
  expect(selectedRevision(view)).toBe(fixture.first.revisionId)
  // The baseline control reads the chosen revision the same way the selection did.
  const compare = view.combobox(copy.compare)
  await pressKey('ArrowDown', compare)
  // Opening focuses the held baseline; one press reaches the older revision.
  await pressKey('ArrowDown')
  await pressKey('Enter')
  expect(visibleText(compare)).toContain(`${copy.revision} ${fixture.first.sequence}`)
  expect(stub.calls.filter(call => call.method === 'GET')).toHaveLength(2)
  // Nothing differs: the page says so and renders no difference row.
  expect(view.statuses()).toContain(sameRevision)
  expect(view.container.querySelectorAll('[data-change]')).toHaveLength(0)
})
