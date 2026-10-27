import { act } from 'react'
import { afterEach, expect, it } from 'vitest'
import { highlightSource } from '@/features/reader/code-tokens'
import { all, containing, one } from '~/tests/dom/shared/dom'
import { READER_CODE_SOURCE, READER_TABLE_CAPTION } from './fixtures'
import {
  mountReader,
  readerContentFixture,
  readerHighlightedFixture,
  readerNavigationFixture,
  resetReaders,
} from './reader-support'

afterEach(() => {
  resetReaders()
})

function taskName(checkbox: HTMLElement): string {
  const labelledBy = checkbox.getAttribute('aria-labelledby')
  if (labelledBy === null) {
    return ''
  }
  return labelledBy.split(/\s+/)
    .map(id => checkbox.ownerDocument.getElementById(id)?.textContent ?? '')
    .join(' ')
    .replaceAll(/\s+/g, ' ')
    .trim()
}

for (const language of ['text', 'legacy-lang']) {
  it(`reader preserves unhighlighted ${language} source as literal text`, () => {
    const view = mountReader(readerContentFixture())
    const pre = one<HTMLPreElement>(view.container, `pre[data-language="${language}"]`)

    expect(pre.querySelector('code')?.textContent).toBe(READER_CODE_SOURCE)
    expect(pre.querySelector('.reader-code-token, img, script')).toBeNull()
    expect(pre.classList.contains('overflow-x-auto')).toBe(true)
    expect(pre.querySelector('code')?.classList.contains('font-mono')).toBe(true)
  })
}

it('reader headings, lists and tasks preserve semantic markup and typography classes', () => {
  const view = mountReader(readerContentFixture())
  const article = one<HTMLElement>(view.container, 'article.reader')
  const body = one<HTMLElement>(article, '.reader-body')

  expect(body.classList.contains('font-serif')).toBe(true)
  expect(body.classList.contains('[&_:is(h2,h3,h4)]:font-sans')).toBe(true)
  expect(body.classList.contains('[&_pre]:font-mono')).toBe(true)
  expect(body.classList.contains('[&_ul:not(.task-list)]:list-disc')).toBe(true)
  expect(body.classList.contains('[&_ol]:list-decimal')).toBe(true)
  expect(all(body, 'h2, h3, h4').map(heading => heading.tagName)).toEqual([
    'H2',
    'H3',
    'H4',
  ])
  expect(body.querySelector('ul:not(.task-list)')).not.toBeNull()
  const orderedLists = all<HTMLOListElement>(body, 'ol[start="4"]')
  expect(orderedLists).toHaveLength(2)
  const standaloneNumbers = orderedLists.at(-1)
  if (standaloneNumbers === undefined) {
    throw new Error('The reader fixture omitted the standalone ordered list')
  }
  expect(standaloneNumbers.querySelectorAll(':scope > li')).toHaveLength(2)

  const tasks = all<HTMLElement>(body, '[role="checkbox"]')
  expect(tasks).toHaveLength(2)
  expect(tasks.map(task => taskName(task))).toEqual(['Finished task', 'Pending task'])
  expect(tasks.map(task => task.getAttribute('aria-checked'))).toEqual(['true', 'false'])
  expect(tasks.every(task => task.hasAttribute('disabled'))).toBe(true)
  expect(tasks.every(task => task.classList.contains('ztd-checkbox'))).toBe(true)
  expect(body.textContent).toContain('Nested task description')
})

it('reader highlights source as text without interpreting embedded markup', async () => {
  const view = mountReader(readerHighlightedFixture())
  const pre = one<HTMLPreElement>(view.container, 'pre[data-language="typescript"]')

  await act(async () => {
    expect(await highlightSource(READER_CODE_SOURCE, 'typescript')).not.toBeNull()
  })
  expect(pre.querySelectorAll('.reader-code-token').length).toBeGreaterThan(0)
  expect(pre.querySelector('code')?.textContent).toBe(READER_CODE_SOURCE)
  expect(pre.querySelectorAll('img, script')).toHaveLength(0)
})

it('reader table captions name focusable regions and preserve table semantics', () => {
  const view = mountReader(readerContentFixture())
  const region = one<HTMLElement>(view.container, '.table-scroll')
  const caption = one<HTMLTableCaptionElement>(region, 'caption')
  const table = one<HTMLTableElement>(region, 'table')

  expect(region.getAttribute('role')).toBe('region')
  expect(region.getAttribute('aria-labelledby')).toBe(caption.id)
  expect(region.tabIndex).toBe(0)
  expect(caption.textContent).toBe(READER_TABLE_CAPTION)
  expect(table.querySelectorAll('th[scope="col"]')).toHaveLength(6)
})

it('reader contents link to nested headings without opening disclosure details', () => {
  const view = mountReader(readerNavigationFixture())
  const nav = one<HTMLElement>(view.container, 'nav[aria-label="Reader sections"]')
  const links = all<HTMLAnchorElement>(nav, 'a')
  const headings = [
    containing(view.container, '.reader-body h2, .reader-body h3, .reader-body h4', 'First section'),
    containing(view.container, '.reader-body h2, .reader-body h3, .reader-body h4', 'Inside nested details'),
  ]
  const details = all<HTMLDetailsElement>(view.container, 'article.reader details')

  expect(links.map(link => link.textContent.trim())).toEqual(['First section', 'Inside nested details'])
  const headingFragments = headings.map((target) => {
    const block = target.parentElement
    if (block === null) {
      throw new Error(`The heading "${target.textContent}" has no reader block`)
    }
    return `#${block.id}`
  })
  expect(links.map(link => link.getAttribute('href'))).toEqual(headingFragments)
  expect(details).toHaveLength(2)
  expect(details.map(detail => detail.open)).toEqual([false, false])
})
