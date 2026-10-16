import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { openDocumentSchema } from '@/content/contracts'
import { draftPreview } from '~/tests/support/browser/preview'

export async function focusPosition(page: Page, position: number): Promise<void> {
  await page.evaluate((location) => {
    const paragraphs = document.querySelectorAll(
      '.bn-block-content[data-content-type="paragraph"] .bn-inline-content',
    )
    const choices = [
      paragraphs[0],
      paragraphs[Math.floor(paragraphs.length / 2)],
      document.querySelector('.bn-editor table tr:last-child td:last-child p'),
      paragraphs[paragraphs.length - 1],
    ]
    const target = choices[location]
    const editor = document.querySelector<HTMLElement>('.bn-editor')
    if (target === undefined || target === null || editor === null) {
      throw new Error(`Missing performance position ${location}`)
    }
    target.scrollIntoView({ block: 'center' })
    editor.focus({ preventScroll: true })
    const range = document.createRange()
    range.selectNodeContents(target)
    range.collapse(false)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  }, position)
}

export async function instrumentation(page: Page): Promise<void> {
  await page.evaluate(() => {
    const input: number[] = []
    const navigation: number[] = []
    const editor = document.querySelector('.bn-editor')
    if (editor === null) {
      throw new Error('Missing editor')
    }
    const measure = (values: number[]): void => {
      const start = performance.now()
      requestAnimationFrame(() =>
        requestAnimationFrame(() => values.push(performance.now() - start)),
      )
    }
    editor.addEventListener('beforeinput', () => measure(input), true)
    editor.addEventListener(
      'keydown',
      (event) => {
        if (
          event instanceof KeyboardEvent
          && [
            'ArrowLeft',
            'ArrowRight',
            'z',
            'Z',
          ].includes(event.key)
        ) {
          measure(navigation)
        }
      },
      true,
    )
    Object.defineProperty(window, '__cmsPerformance', {
      value: { input, navigation },
      configurable: true,
    })
  })
}

export async function samples(page: Page, key: 'input' | 'navigation'): Promise<number[]> {
  return await page.evaluate((name) => {
    const state: unknown = Reflect.get(window, '__cmsPerformance')
    if (state === null || typeof state !== 'object' || !(name in state)) {
      throw new Error('Missing performance samples')
    }
    const values: unknown = Reflect.get(state, name)
    if (!Array.isArray(values)) {
      throw new TypeError('Invalid performance samples')
    }
    return values.filter((value): value is number => typeof value === 'number')
  }, key)
}

export async function verifySaved(page: Page, id: string): Promise<number[]> {
  await expect(page.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible({
    timeout: 15000,
  })
  const saved = openDocumentSchema.parse(
    await (await page.request.get(`/api/admin/documents/${id}`)).json(),
  )
  const json = JSON.stringify(saved.document)
  for (let index = 0; index < 4; index++) {
    expect(json).toContain(`PERF_${index}_`)
  }
  const locations = await page
    .locator('.bn-block-content')
    .evaluateAll(elements =>
      Array.from({ length: 4 }, (_, index) =>
        elements.findIndex(element => element.textContent.includes(`PERF_${index}_`))),
    )
  expect(new Set(locations).size).toBe(4)
  expect(locations.every(index => index >= 0)).toBe(true)
  return locations
}

export async function previewSamples(page: Page): Promise<number[]> {
  const initial = await draftPreview(page)
  await expect(initial).toContainText('PERF_3_')
  await initial.getByRole('button', { name: 'Close preview', exact: true }).click()
  await expect(initial).toHaveCount(0)
  const values: number[] = []
  for (let index = 0; index < 12; index++) {
    await focusPosition(page, 3)
    const marker = `PREVIEW_${index}_`
    await page.keyboard.insertText(marker)
    const started = Date.now()
    const preview = await draftPreview(page)
    await expect(preview).toContainText(marker, { timeout: 5000 })
    values.push(Date.now() - started)
    await preview.getByRole('button', { name: 'Close preview', exact: true }).click()
    await expect(preview).toHaveCount(0)
  }
  return values
}

export async function captures(page: Page): Promise<number[]> {
  return await page.evaluate(() =>
    performance.getEntriesByName('cms-snapshot-capture').map(item => item.duration),
  )
}
