import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { fixture } from '~/tests/browser/editor/blocks/block-action-helpers'
import { tableDocument } from '~/tests/browser/editor/tables/table-overlay-helpers'
import { writeDocument } from '~/tests/support/browser/document'
import { setChinese } from '~/tests/support/browser/locale'

export const labels = {
  en: {
    title: 'Title',
    publish: 'Publish',
    caption: 'Table caption',
    saved: 'Saved',
    error: 'Publication checks failed',
  },
  zh: { title: '标题', publish: '发布', caption: '表格标题', saved: '已保存', error: '发布未通过检查' },
}

export async function publicationTables(page: Page, locale: 'en' | 'zh' = 'en', complete = false): Promise<{
  document: ReturnType<typeof fixture>
  initial: Awaited<ReturnType<typeof writeDocument>>
  first: string
  second: string
}> {
  const document = fixture(36)
  const first = tableDocument().blocks[0]
  if (first === undefined) {
    throw new Error('Missing table fixture')
  }
  const second = { ...structuredClone(first), id: crypto.randomUUID() }
  document.blocks.push(first, second)
  if (complete) {
    document.tableAccessibility = {
      [first.id]: { caption: 'First table' },
      [second.id]: { caption: 'Second table' },
    }
  }
  const initial = await writeDocument(page, document)
  if (locale === 'zh') {
    await setChinese(page)
  }
  return { document, initial, first: first.id, second: second.id }
}

export function captionButton(page: Page, id: string): Locator {
  return page.locator(`[data-id="${id}"] .editor-table-caption button`)
}

export function locateTable(container: Locator, count: number): Locator {
  return container.getByRole('button', { name: new RegExp(`(?:Add a caption|请为各表格).*(?:\\(${count}\\)|${count} 处)`) })
}

export async function expectCaptionTarget(page: Page, id: string): Promise<void> {
  await expect(captionButton(page, id)).toBeFocused()
  await expect(captionButton(page, id)).toBeInViewport()
  const top = await captionButton(page, id).evaluate(element => element.getBoundingClientRect().top)
  const toolbarBottom = await page.getByRole('toolbar').evaluate(element => element.getBoundingClientRect().bottom)
  expect(top).toBeGreaterThanOrEqual(toolbarBottom)
}

export async function saveCaption(page: Page, id: string, caption: string, locale: 'en' | 'zh'): Promise<void> {
  await captionButton(page, id).press('Enter')
  const input = page.getByRole('textbox', { name: labels[locale].caption, exact: true })
  await expect(input).toBeFocused()
  await input.fill(caption)
  await expect(input).toBeFocused()
  await input.press('Enter')
}
