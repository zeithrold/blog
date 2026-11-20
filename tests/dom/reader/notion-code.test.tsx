import type { PageSnapshot } from '@/contracts/notion'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { NotionBody } from '@/features/reader/notion-body'
import { installBrowserShims } from '~/tests/dom/shared/environment'
import { mountPublic } from '../shell/public-support'
import { pageFixture } from './notion-fixture'

function codePage(language: string, source: string): PageSnapshot {
  const page = pageFixture()
  const entry = page.recordMap.block.code
  if (entry === undefined || !('type' in entry.value) || entry.value.type !== 'code') {
    throw new TypeError('Expected a code block in the reader fixture')
  }
  return {
    ...page,
    recordMap: {
      ...page.recordMap,
      block: {
        ...page.recordMap.block,
        code: {
          ...entry,
          value: {
            ...entry.value,
            properties: {
              ...entry.value.properties,
              title: [
                [source],
              ],
              language: [
                [language],
              ],
            },
          },
        },
      },
    },
  }
}

let view: ReturnType<typeof mountPublic> | undefined

beforeEach(installBrowserShims)
afterEach(() => {
  view?.unmount()
  view = undefined
})

it.each([
  { language: 'Go', source: 'package main', token: 'package' },
  { language: 'Bash', source: 'if true; then echo ok; fi', token: 'if' },
  { language: 'Shell', source: 'export PATH="/bin:$PATH"', token: 'export' },
  { language: 'Python', source: 'def answer():\n    return 42', token: 'def' },
  { language: 'Rust', source: 'fn main() {}', token: 'fn' },
  { language: 'Java', source: 'class Main {}', token: 'class' },
  { language: 'C', source: 'int main(void) { return 0; }', token: 'return' },
  { language: 'C++', source: 'namespace project {}', token: 'namespace' },
  { language: 'C#', source: 'namespace Project { class Main {} }', token: 'namespace' },
  { language: 'SQL', source: 'SELECT name FROM authors;', token: 'SELECT' },
  { language: 'YAML', source: 'enabled: true', token: 'enabled' },
  { language: 'Docker', source: 'FROM scratch', token: 'FROM' },
  { language: 'TOML', source: 'enabled = true', token: 'enabled' },
  { language: 'JavaScript', source: 'const answer = 42', token: 'const' },
])('highlights $language code without changing its text', ({ language, source, token }) => {
  view = mountPublic(<NotionBody page={codePage(language, source)} />)

  const code = view.container.querySelector('.notion-code code')
  expect(code?.textContent).toBe(source)
  expect(Array.from(code?.querySelectorAll('.token') ?? [], node => node.textContent)).toContain(token)
})

it.each(['Plain Text', 'Unknown Language'])('keeps %s snippets literal and untokenized', (language) => {
  const source = 'const text = "<b>&</b>"'
  view = mountPublic(<NotionBody page={codePage(language, source)} />)

  const code = view.container.querySelector('.notion-code code')
  expect(code?.textContent).toBe(source)
  expect(code?.childElementCount).toBe(0)
})
