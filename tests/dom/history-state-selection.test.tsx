import type { StoredRevision } from './history-page-support'
import type { PageView } from './history-state-support'
import type { HistoryCopy } from '~/tests/components/support/history-copy'
import { afterEach, expect, it } from 'vitest'
import { historyCopy } from '~/tests/components/support/history-copy'
import {
  failure,
  historyCase,
  historyOf,
  page,
  readRevision,
  requestLines,
  savedElsewhere,
  serveFetch,
  writes,
} from './history-page-support'
import {
  click,
  pressKey,
  renderPage,
  requirements,
  resetDomPage,
  revisionRows,
  selectedRevision,
  visibleText,
} from './history-state-support'

/**
 * Selecting, comparing and confirming on the history page, rendered in jsdom.
 *
 * The sidebar buttons and both select triggers are the page's own controls: a
 * case clicks or keys them exactly as a reader would, and the HTTP table answers
 * only what the page actually asks for. Cases that read labels run in both
 * locales, because a translated label is real page state. Nothing here measures
 * position, hit target, focus return or animation; those stay browser checks.
 */

const copy = historyCopy.en

/** The locales the page renders; the label-reading cases run in both. */
const pageLocales = ['en', 'zh-CN'] as const

type PageLocale = typeof pageLocales[number]

function copyFor(locale: PageLocale): HistoryCopy {
  return historyCopy[locale === 'en' ? 'en' : 'zh']
}

function revisionRow(text: HistoryCopy, sequence: number): RegExp {
  return new RegExp(`^${text.revision} ${sequence}\\b`)
}

/**
 * Opens the changed document-title field and reads both sides of it.
 *
 * The title field uses the page's localized label, independently expected here.
 */
async function openTitleDifference(
  view: PageView,
  locale: PageLocale = 'en',
): Promise<{ before: string, after: string }> {
  await click(view.button(locale === 'en' ? 'title' : '标题'))
  return {
    before: visibleText(view.container.querySelector('[data-side="before"]')),
    after: visibleText(view.container.querySelector('[data-side="after"]')),
  }
}

/**
 * The case's two revisions, rewritten so they share one paragraph block.
 *
 * A comparison only calls a block changed when the same block id holds different
 * content; two documents built independently describe an added and a removed
 * block instead. This keeps the id and changes the text.
 */
function comparableCase(): ReturnType<typeof historyCase> {
  const fixture = historyCase()
  const sharedId = fixture.latest.document.blocks[0]?.id
  if (sharedId === undefined) {
    throw new TypeError('The fixture has no paragraph block to compare')
  }
  const document = structuredClone(fixture.first.document)
  const block = document.blocks[0]
  if (block === undefined) {
    throw new TypeError('The fixture revision has no paragraph block to compare')
  }
  block.id = sharedId
  const first: StoredRevision = { ...fixture.first, document }
  const stored = fixture.stored.map(item => (item.revisionId === first.revisionId ? first : item))
  return {
    ...fixture,
    first,
    stored,
    history: historyOf(stored),
  }
}

afterEach(resetDomPage)

for (const locale of pageLocales) {
  const text = copyFor(locale)
  it(`reads a chosen revision, rewrites the comparison and writes nothing in ${locale}`, async () => {
    const fixture = historyCase()
    const stub = serveFetch({
      [`GET ${fixture.path}/revisions/${fixture.first.revisionId}`]: () => readRevision(fixture.first),
    })
    const view = renderPage(page(fixture), locale)
    // The page opens comparing the held head revision with itself.
    expect(selectedRevision(view)).toBe(fixture.latest.revisionId)
    expect(visibleText(view.combobox(text.compare))).toContain(text.currentDraft)
    await click(view.button(revisionRow(text, fixture.first.sequence)))
    expect(selectedRevision(view)).toBe(fixture.first.revisionId)
    // Choosing a revision is a read of that revision, and nothing else.
    expect(requestLines(stub)).toEqual([
      `GET ${fixture.path}/revisions/${fixture.first.revisionId}`,
    ])
    expect(writes(stub)).toEqual([])
    // An older revision that is already published cannot be published again.
    expect(view.button(text.publish).disabled).toBe(true)
    expect(view.button(text.restore).disabled).toBe(false)
    const difference = await openTitleDifference(view, locale)
    expect(difference.before).toContain(fixture.latest.document.meta.title)
    expect(difference.after).toContain(fixture.first.document.meta.title)
  })
}

it('adopts the refreshed baseline without a manual refresh after a conflict', async () => {
  const fixture = historyCase()
  const external = savedElsewhere(fixture, 'Another tab changed the draft')
  const stub = serveFetch({
    [`GET ${fixture.path}/revisions/${fixture.first.revisionId}`]: () => readRevision(fixture.first),
    [`POST ${fixture.path}/restore`]: () => failure(409, 'EDIT_CONFLICT'),
    // The refused write is answered by reading, and this read succeeds.
    [`GET ${fixture.path}`]: () => ({ body: external.initial }),
    [`GET ${fixture.path}/revisions`]: () => ({ body: external.history }),
  })
  const view = renderPage(page(fixture))
  await click(view.button(revisionRow(copy, fixture.first.sequence)))
  await click(view.button(copy.restore))
  await click(view.button(copy.confirm))
  expect(view.statuses()).toContain(copy.conflict)
  // The page answered the conflict itself: nothing stays locked and no alert remains.
  expect(view.alert()).toBeNull()
  expect(view.button(copy.restore).disabled).toBe(false)
  expect(view.combobox(copy.compare).disabled).toBe(false)
  expect(visibleText(view.combobox(copy.compare))).toContain(`${copy.revision} ${external.revision.sequence}`)
  expect(visibleText(view.combobox(copy.compare))).toContain(copy.currentDraft)
  expect(selectedRevision(view)).toBe(fixture.first.revisionId)
  // The conflict is answered by refreshing, never by repeating the refused write.
  expect(writes(stub)).toHaveLength(1)
  expect(writes(stub)[0]?.body).toEqual({
    expectedVersion: fixture.initial.version,
    revisionId: fixture.first.revisionId,
  })
  // The new baseline is the document another tab saved, not the held draft.
  const difference = await openTitleDifference(view)
  expect(difference.before).toContain('Another tab changed the draft')
  expect(difference.after).toContain(fixture.first.document.meta.title)
})

it('keeps the conflict readable when loading the new baseline is refused', async () => {
  const fixture = historyCase()
  const external = savedElsewhere(fixture, 'Another tab changed the draft')
  let documentReads = 0
  const stub = serveFetch({
    [`GET ${fixture.path}/revisions/${fixture.first.revisionId}`]: () => readRevision(fixture.first),
    [`POST ${fixture.path}/restore`]: () => failure(409, 'EDIT_CONFLICT'),
    // The refused write is answered by reading; the first of those reads is refused too.
    [`GET ${fixture.path}`]: () => {
      documentReads += 1
      if (documentReads === 1) {
        return failure(503, 'UNAVAILABLE')
      }
      return { body: external.initial }
    },
    [`GET ${fixture.path}/revisions`]: () => ({ body: external.history }),
  })
  const view = renderPage(page(fixture))
  await click(view.button(revisionRow(copy, fixture.first.sequence)))
  await click(view.button(copy.restore))
  await click(view.button(copy.confirm))
  expect(view.statuses()).toContain(copy.conflict)
  expect(visibleText(view.alert())).toBe(copy.refreshRequired)
  expect(view.button(copy.restore).disabled).toBe(true)
  // The conflict was answered by refreshing, never by repeating the refused write.
  expect(writes(stub)).toHaveLength(1)
  expect(writes(stub)[0]?.body).toEqual({
    expectedVersion: fixture.initial.version,
    revisionId: fixture.first.revisionId,
  })
  await click(view.button(copy.refresh))
  expect(view.alert()).toBeNull()
  expect(view.button(copy.restore).disabled).toBe(false)
  // The baseline is the revision another tab saved; the selection is untouched.
  expect(visibleText(view.combobox(copy.compare))).toContain(`${copy.revision} ${external.revision.sequence}`)
  expect(visibleText(view.combobox(copy.compare))).toContain(copy.currentDraft)
  expect(selectedRevision(view)).toBe(fixture.first.revisionId)
  const difference = await openTitleDifference(view)
  expect(difference.before).toContain('Another tab changed the draft')
  expect(difference.after).toContain(fixture.first.document.meta.title)
})

for (const locale of pageLocales) {
  const text = copyFor(locale)
  it(`selects a revision with the narrow select exactly as the sidebar does in ${locale}`, async () => {
    const fixture = historyCase()
    const stub = serveFetch({
      [`GET ${fixture.path}/revisions/${fixture.first.revisionId}`]: () => readRevision(fixture.first),
    })
    const view = renderPage(page(fixture), locale)
    const selected = view.combobox(text.selected)
    await pressKey('ArrowDown', selected)
    // Opening focuses the held selection; one press moves to the older revision.
    await pressKey('ArrowDown')
    await pressKey('Enter')
    expect(selectedRevision(view)).toBe(fixture.first.revisionId)
    expect(requestLines(stub)).toEqual([
      `GET ${fixture.path}/revisions/${fixture.first.revisionId}`,
    ])
    expect(writes(stub)).toEqual([])
  })
}

for (const locale of pageLocales) {
  const text = copyFor(locale)
  it(`selects a baseline with the keyboard and compares against the stored revision in ${locale}`, async () => {
    const fixture = historyCase()
    const stub = serveFetch({
      [`GET ${fixture.path}/revisions/${fixture.created.revisionId}`]: () => readRevision(fixture.created),
    })
    const view = renderPage(page(fixture), locale)
    const compare = view.combobox(text.compare)
    await pressKey('ArrowDown', compare)
    // Opening focuses the current baseline; each further press moves one older revision.
    await pressKey('ArrowDown')
    await pressKey('ArrowDown')
    await pressKey('Enter')
    expect(visibleText(compare)).toContain(`${text.revision} ${fixture.created.sequence}`)
    expect(requestLines(stub)).toEqual([
      `GET ${fixture.path}/revisions/${fixture.created.revisionId}`,
    ])
    expect(writes(stub)).toEqual([])
    // The comparison now runs against the stored revision, not the held draft.
    const difference = await openTitleDifference(view, locale)
    expect(difference.after).toContain(fixture.latest.document.meta.title)
  })
}

for (const locale of pageLocales) {
  const text = copyFor(locale)
  it(`lists why the chosen revision cannot be published in ${locale}`, async () => {
    const fixture = historyCase()
    serveFetch({
      [`GET ${fixture.path}/revisions/${fixture.created.revisionId}`]: () => readRevision(fixture.created),
    })
    const view = renderPage(page(fixture), locale)
    await click(view.button(revisionRow(text, fixture.created.sequence)))
    expect(requirements(view)).toEqual([
      ...text.requirements,
    ])
    expect(view.button(text.publish).disabled).toBe(true)
    expect(view.button(text.restore).disabled).toBe(false)
    // Selecting the held head revision removes the block: the page compares itself.
    await click(view.button(revisionRow(text, fixture.latest.sequence)))
    expect(requirements(view)).toBeNull()
    expect(view.button(text.restore).disabled).toBe(true)
  })
}

for (const locale of pageLocales) {
  const text = copyFor(locale)
  it(`classifies a block that changed between the two compared revisions in ${locale}`, async () => {
    const fixture = comparableCase()
    serveFetch({
      [`GET ${fixture.path}/revisions/${fixture.first.revisionId}`]: () => readRevision(fixture.first),
    })
    const view = renderPage(page(fixture), locale)
    await click(view.button(revisionRow(text, fixture.first.sequence)))
    const rows = Array.from(view.container.querySelectorAll('[data-change]'))
    // The same block, changed: not an addition plus a removal.
    expect(rows).toHaveLength(1)
    const changed = rows[0]
    expect(changed?.getAttribute('data-change')).toBe('changed')
    const trigger = changed?.querySelector('.diff-block-trigger')
    if (trigger === null || trigger === undefined) {
      throw new Error('The changed block offers no trigger to open it')
    }
    await click(trigger)
    expect(visibleText(changed?.querySelector('[data-side="before"]') ?? null)).toContain('Latest draft body')
    expect(visibleText(changed?.querySelector('[data-side="after"]') ?? null)).toContain('First historical body')
  })
}

it('names the publication target and the live URL that stops working before any write', async () => {
  const fixture = historyCase()
  const stub = serveFetch({})
  const view = renderPage(page(fixture))
  await click(view.button(copy.publish))
  const confirmation = visibleText(document.querySelector('[role="dialog"]'))
  expect(confirmation).toContain('/posts/history-latest')
  expect(confirmation).toContain('/posts/history-first')
  await pressKey('Escape')
  expect(document.querySelector('[role="dialog"]')).toBeNull()
  expect(writes(stub)).toEqual([])
  expect(view.button(copy.publish).disabled).toBe(false)
})

for (const locale of pageLocales) {
  const text = copyFor(locale)
  it(`renders revision labels rather than stored identifiers in ${locale}`, async () => {
    const fixture = historyCase()
    serveFetch({
      [`GET ${fixture.path}/revisions/${fixture.first.revisionId}`]: () => readRevision(fixture.first),
    })
    const view = renderPage(page(fixture), locale)
    await click(view.button(revisionRow(text, fixture.first.sequence)))
    const rendered = view.text()
    for (const identifier of [
      fixture.created.revisionId,
      fixture.first.revisionId,
      fixture.latest.revisionId,
      fixture.initial.documentId,
    ]) {
      expect(rendered).not.toContain(identifier)
    }
    expect(revisionRows(view)).toHaveLength(3)
    expect(revisionRows(view)[1]).toContain(`${text.revision} ${fixture.first.sequence}`)
    // The preview entry points at the selected revision, not at the held head.
    const previewLink = view.container.querySelector('a[target="_blank"]')
    expect(previewLink?.getAttribute('href'))
      .toBe(`/admin/preview/${fixture.initial.documentId}/${fixture.first.revisionId}`)
  })
}
