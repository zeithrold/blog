import type { Locator, Page } from '@playwright/test'
import type { Document } from '../../src/content/document'
import { expect } from '@playwright/test'
import { withinViewport } from './block-action-helpers'
import { bounds, documentTable, tableDocument } from './table-overlay-helpers'

type Box = Awaited<ReturnType<typeof bounds>>

function inline(text: string): [{ type: 'text', text: string, styles: Record<string, never> }] {
  return [
    { type: 'text', text, styles: {} },
  ]
}

export function alignedTableDocument(): Document {
  const document = tableDocument(2, 8, 220)
  const table = document.blocks[0]
  if (table === undefined) {
    throw new Error('The alignment fixture has no native table')
  }
  document.meta.title = 'Aligned table content'
  document.blocks = [
    {
      id: crypto.randomUUID(),
      type: 'paragraph',
      props: { textAlignment: 'left', textColor: 'default', backgroundColor: 'default' },
      content: inline('Alignment paragraph'),
      children: [],
    },
    {
      id: crypto.randomUUID(),
      type: 'codeBlock',
      props: { language: 'text' },
      content: inline('const total = 1'),
      children: [],
    },
    { id: crypto.randomUUID(), type: 'math', props: {}, content: inline('x^2+y^2=z^2'), children: [] },
    table,
    {
      id: crypto.randomUUID(),
      type: 'paragraph',
      props: { textAlignment: 'left', textColor: 'default', backgroundColor: 'default' },
      content: inline('After the table'),
      children: [],
    },
  ]
  return document
}

export async function readyAlignedBlocks(page: Page): Promise<void> {
  const body = page.getByLabel('Document body', { exact: true })
  await expect(body.locator('[data-content-type="math"] math')).toBeVisible()
  await expect(body.locator('[data-content-type="codeBlock"] pre code')).toHaveText('const total = 1')
  await page.evaluate(async () => {
    await document.fonts.ready
  })
}

export async function alignedContentEdges(page: Page, zeroScroll = true): Promise<Box> {
  const body = page.getByLabel('Document body', { exact: true })
  const table = documentTable(page)
  const viewport = table.locator('xpath=..')
  const tableViewport = await bounds(viewport)
  const peers = [
    body.locator('[data-content-type="paragraph"] .bn-inline-content').first(),
    body.locator('[data-content-type="codeBlock"]'),
    body.locator('[data-content-type="math"] .bn-preview-with-source-popup').locator('xpath=..'),
  ]
  for (const peer of peers) {
    expect(Math.abs((await bounds(peer)).x - tableViewport.x)).toBeLessThanOrEqual(2)
  }
  if (zeroScroll) {
    expect(await viewport.evaluate(element => element.scrollLeft)).toBe(0)
    expect(Math.abs((await bounds(table.locator('td, th').first())).x - tableViewport.x)).toBeLessThanOrEqual(2)
  }
  await withinViewport(page, viewport)
  return tableViewport
}

export function sameTableLayout(before: Box, after: Box): void {
  for (const field of [
    'x',
    'y',
    'width',
    'height',
  ] as const) {
    expect(Math.abs(before[field] - after[field])).toBeLessThanOrEqual(1)
  }
}

export async function tableControlsOpacity(page: Page, value: '0' | '1'): Promise<void> {
  for (const bar of [
    page.locator('.editor-table-column-bar'),
    page.locator('.editor-table-row-bar'),
  ]) {
    await expect(bar).toHaveCSS('opacity', value)
    if (value === '0') {
      await expect(bar).toHaveCSS('pointer-events', 'none')
    }
    else {
      await expect(bar).not.toHaveCSS('pointer-events', 'none')
    }
  }
}

export async function leaveTable(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'More document actions', exact: true }).focus()
  await page.mouse.move(1, 1)
}

export async function revealAlignedTable(page: Page): Promise<Locator> {
  const table = documentTable(page)
  const viewport = await bounds(table.locator('xpath=..'))
  const cell = await bounds(table.locator('td, th').first())
  await page.mouse.move(viewport.x + Math.min(20, viewport.width / 2), cell.y + cell.height / 2)
  await tableControlsOpacity(page, '1')
  return table
}

export async function focusTableControl(page: Page): Promise<Locator> {
  const control = page.getByRole('button', { name: 'Column 1 options', exact: true })
  await page.keyboard.press('Tab')
  await control.focus()
  await expect(control).toBeFocused()
  await page.mouse.move(1, 1)
  return control
}
