import type { Locator, Page } from '@playwright/test'
import type { Block } from '@/content/document'
import { expect } from '@playwright/test'
import { openDocumentSchema } from '@/content/contracts'
import { bounds } from '~/tests/browser/editor/tables/table-overlay-helpers'
import { withinViewport } from '~/tests/support/browser/layout'
import { fixture } from './block-action-helpers'

export function gapDocument(): ReturnType<typeof fixture> {
  const document = fixture(4)
  const parent = document.blocks[2]
  if (parent === undefined) {
    throw new Error('The mobile spacing fixture has no parent list item')
  }
  parent.type = 'bulletListItem'
  parent.children = ['Nested first item', 'Nested second item'].map(text => ({
    id: crypto.randomUUID(),
    type: 'bulletListItem',
    props: { textAlignment: 'left', textColor: 'default', backgroundColor: 'default' },
    content: [
      { type: 'text', text, styles: {} },
    ],
    children: [],
  }))
  return document
}

export function topLevelBlocks(page: Page): Locator {
  return page.getByLabel('Document body', { exact: true })
    .locator(':scope > [data-node-type="blockGroup"] > [data-node-type="blockOuter"]')
}

export function firstNestedGapItem(page: Page): Locator {
  const items = topLevelBlocks(page).nth(2).locator('[data-content-type="bulletListItem"]')
  return items.filter({ hasText: 'Nested first item' })
}

export async function documentBlocks(page: Page): Promise<Block[]> {
  const path = new URL(page.url()).pathname.replace('/admin/documents/', '/api/admin/documents/')
  const response = await page.request.get(path)
  expect(response.ok()).toBe(true)
  return openDocumentSchema.parse(await response.json()).document.blocks
}

export async function documentLayout(page: Page): Promise<unknown> {
  return await topLevelBlocks(page).evaluateAll((elements) => {
    const editor = elements[0]?.closest('.bn-editor')?.getBoundingClientRect()
    if (editor === undefined) {
      throw new Error('The mobile spacing fixture has no editor layout')
    }
    return elements.map((element) => {
      const rectangle = element.getBoundingClientRect()
      return {
        left: rectangle.left - editor.left,
        top: rectangle.top - editor.top,
        width: rectangle.width,
        height: rectangle.height,
      }
    })
  })
}

export async function expectMobileBlockSpacing(page: Page): Promise<void> {
  const body = page.getByLabel('Document body', { exact: true })
  await expect(body).toHaveCSS('padding-left', '16px')
  await expect(body).toHaveCSS('padding-right', '16px')
  const blocks = topLevelBlocks(page)
  await expect(blocks).toHaveCount(4)
  for (let index = 1; index < 4; index++) {
    const previous = await bounds(blocks.nth(index - 1))
    const current = await bounds(blocks.nth(index))
    expect(Math.abs(current.y - previous.y - previous.height - 48)).toBeLessThanOrEqual(1)
  }
  const inline = blocks.first().locator('.bn-inline-content')
  const line = await bounds(inline)
  expect(Math.abs(line.x - 16)).toBeLessThanOrEqual(1)
  expect(Math.abs(line.width - ((page.viewportSize()?.width ?? 0) - 32))).toBeLessThanOrEqual(1)
  const nested = blocks.nth(2).locator('[data-node-type="blockGroup"] > [data-node-type="blockOuter"]')
  await expect(nested).toHaveCount(2)
  const first = await bounds(nested.first())
  const second = await bounds(nested.last())
  expect(Math.abs(second.y - first.y - first.height - 12)).toBeLessThanOrEqual(1)
  const last = await bounds(blocks.last())
  const editor = await bounds(body)
  expect(editor.y + editor.height - last.y - last.height).toBeGreaterThanOrEqual(48)
}

export async function expectControlsInBlockGap(page: Page, block: Locator): Promise<void> {
  const outer = block.locator('xpath=ancestor::*[@data-node-type="blockOuter"][last()]')
  const current = await bounds(outer)
  const next = outer.locator('xpath=following-sibling::*[@data-node-type="blockOuter"][1]')
  const limit = await next.count() === 0
    ? await bounds(page.getByLabel('Document body', { exact: true }))
    : await bounds(next)
  const gapEnd = await next.count() === 0 ? limit.y + limit.height : limit.y
  const group = page.locator('.editor-side[data-slot="button-group"]')
  await expect(group).toBeVisible()
  await expect(group).toHaveAttribute('data-orientation', 'horizontal')
  const controls = await bounds(group)
  expect(Math.abs(controls.x - current.x)).toBeLessThanOrEqual(2)
  expect(controls.y).toBeGreaterThanOrEqual(current.y + current.height - 1)
  expect(controls.y + controls.height).toBeLessThanOrEqual(gapEnd + 1)
  await withinViewport(page, group)
  await expect(group.getByRole('button')).toHaveCount(2)
  for (const button of await group.getByRole('button').all()) {
    const target = await bounds(button)
    expect(target.width).toBeGreaterThanOrEqual(44)
    expect(target.height).toBeGreaterThanOrEqual(44)
    await expect(button).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    const visual = await bounds(button.locator('.editor-side-glyph'))
    expect(Math.abs(visual.width - 32)).toBeLessThanOrEqual(1)
    expect(Math.abs(visual.height - 32)).toBeLessThanOrEqual(1)
    const icon = await bounds(button.locator('svg').first())
    expect(Math.max(icon.width, icon.height)).toBeLessThanOrEqual(24)
  }
}

export async function hideBlockControls(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'More document actions', exact: true }).focus()
  await page.mouse.move(1, 1)
  await expect(page.locator('.editor-side')).not.toBeVisible()
}
