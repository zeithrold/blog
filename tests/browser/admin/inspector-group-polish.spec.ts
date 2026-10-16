import type { Page } from '@playwright/test'
import { emptyDocument } from '@/content/empty'
import { blockActions, fixture, reveal } from '~/tests/browser/editor/blocks/block-action-helpers'
import { writeDocument } from '~/tests/support/browser/document'
import { withinViewport } from '~/tests/support/browser/layout'
import { expect, test } from '~/tests/support/browser/test'

async function openInspector(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 740 })
  const document = emptyDocument()
  document.meta.title = 'A single scrolling inspector'
  await writeDocument(page, document)
  await page.getByRole('button', { name: 'Document settings', exact: true }).click()
  await page.getByText('Tags and series', { exact: true }).click()
}

for (const width of [320, 700]) {
  test(`settings retain one scroll container and plain catalog fields at ${width}px`, async ({ page }, info) => {
    await openInspector(page, width)
    const drawer = page.getByRole('dialog', { name: 'Document settings', exact: true })
    const scroll = drawer.getByRole('region', { name: 'Document settings', exact: true })
    await expect(drawer).toHaveCSS('overflow-y', 'clip')
    await expect(drawer.locator('.catalog-selection fieldset')).toHaveCount(0)
    await expect(drawer.locator('.catalog-field')).toHaveCount(2)
    const scrollers = await drawer.evaluate(element => [
      element,
      ...element.querySelectorAll('*'),
    ]
      .filter((node) => {
        const style = getComputedStyle(node)
        return ['auto', 'scroll'].includes(style.overflowY)
          && node.clientHeight > 0 && node.scrollHeight > node.clientHeight + 1
      })
      .map(node => node.getAttribute('class') ?? ''))
    expect(scrollers).toHaveLength(1)
    expect(scrollers[0]).toContain('ztd-scroll-viewport')
    await scroll.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
    await expect.poll(async () => await scroll.evaluate(element => element.scrollTop)).toBeGreaterThan(0)
    await drawer.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
    expect(await drawer.evaluate(element => element.scrollTop)).toBe(0)
    await expect(drawer.getByRole('heading', { name: 'Document settings', exact: true })).toBeInViewport()
    await expect(drawer.getByRole('button', { name: 'Close', exact: true })).toBeInViewport()
    for (const name of ['Tags', 'Series']) {
      const control = drawer.getByRole('combobox', { name, exact: true })
      await expect(control).toBeVisible()
      const id = await control.getAttribute('id')
      if (id === null) {
        throw new Error('The catalog control must have an associated label')
      }
      await expect(drawer.locator('label').filter({ hasText: new RegExp(`^${name}$`) })).toHaveAttribute('for', id)
    }
    await expect(drawer.getByRole('link', { name: 'Manage tags', exact: true }))
      .toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath(`inspector-single-scroll-${width}.png`) })
    await drawer.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Document settings', exact: true })).toBeFocused()
  })
}

for (const width of [320, 1440]) {
  test(`block actions form a vertical menu below horizontal side controls at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 })
    await writeDocument(page, fixture(3))
    await reveal(page, 1)
    await expect(page.locator('.editor-side')).toHaveAttribute('data-orientation', 'horizontal')
    const addBox = await page.getByRole('button', { name: 'Add block', exact: true }).boundingBox()
    const menuBox = await page.getByRole('button', { name: 'Open block menu', exact: true }).boundingBox()
    if (addBox === null || menuBox === null) {
      throw new Error('The block toolbar must have two visible controls')
    }
    expect(Math.abs(addBox.y - menuBox.y)).toBeLessThanOrEqual(1)
    await page.getByRole('button', { name: 'Open block menu', exact: true }).click()
    const actions = page.locator('.editor-block-action-list')
    const remove = actions.getByRole('button', { name: 'Delete', exact: true })
    const colors = actions.getByRole('button', { name: 'Colors', exact: true })
    await expect(remove).toBeFocused()
    await expect(colors).toBeVisible()
    await withinViewport(page, blockActions(page))
    if (width >= 701) {
      await expect(blockActions(page)).toHaveCSS('opacity', '1')
    }
    await expect(actions.getByRole('button')).toHaveCount(2)
    const [removeBox, colorsBox] = await actions.getByRole('button').evaluateAll(elements => elements.map((element) => {
      const box = element.getBoundingClientRect()
      return { x: box.x, y: box.y, width: box.width, height: box.height }
    }))
    if (removeBox === undefined || colorsBox === undefined) {
      throw new Error('Both block actions must have visible hit targets')
    }
    expect(Math.abs(removeBox.x - colorsBox.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(removeBox.width - colorsBox.width)).toBeLessThanOrEqual(1)
    expect(colorsBox.y).toBeGreaterThanOrEqual(removeBox.y + removeBox.height)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath(`vertical-block-actions-${width}.png`) })
    await page.keyboard.press('Escape')
    await expect(actions).toHaveCount(0)
  })
}
