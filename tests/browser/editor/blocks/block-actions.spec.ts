import type { Page } from '@playwright/test'
import { saved, writeDocument } from '~/tests/support/browser/document'
import { withinViewport } from '~/tests/support/browser/layout'
import { setChinese } from '~/tests/support/browser/locale'
import { expect, test } from '~/tests/support/browser/test'
import {
  blockAction,
  blockActions,
  blockText,
  cancelHandleGestureOutside,
  checkActionFocus,
  checkControls,
  dragBlock,
  fixture,
  labels,
  paragraph,
  reveal,
} from './block-action-helpers'

const pageErrors = new WeakMap<Page, string[]>()
test.beforeEach(({ page }) => {
  const errors: string[] = []
  pageErrors.set(page, errors)
  page.on('pageerror', error => errors.push(error.message))
})
test.afterEach(({ page }) => {
  expect(pageErrors.get(page) ?? []).toEqual([])
})

for (const width of [320, 390]) {
  for (const locale of ['en', 'zh'] as const) {
    test(`block controls stay reachable without covering text after scrolling at ${width}px in ${locale}`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: 740 })
      await writeDocument(page, fixture())
      if (locale === 'zh') {
        await setChinese(page)
      }
      for (const index of [
        1,
        24,
        1,
      ]) {
        const block = await reveal(page, index)
        await checkControls(page, block, locale)
        await page.getByRole('button', { name: labels[locale].menu, exact: true }).click()
        const menu = blockActions(page)
        const remove = blockAction(page, locale, 'remove')
        await expect(remove).toBeVisible()
        await expect(remove.locator('svg').first()).toBeVisible()
        await expect(blockAction(page, locale, 'colors').locator('svg').first()).toBeVisible()
        await withinViewport(page, menu)
        await expect(page.locator('.editor-desktop-block-actions')).toHaveCount(0)
        await page.keyboard.press('Escape')
        await expect(menu).not.toBeVisible()
      }
      await reveal(page, 1)
      await page.screenshot({ path: info.outputPath(`block-controls-${width}-${locale}.png`) })
    })
  }
}

test('desktop add control works across its button and keeps native insertion and deletion', async ({ page }, info) => {
  await writeDocument(page, fixture(3))
  const block = await reveal(page, 1)
  await checkControls(page, block, 'en')
  const add = page.getByRole('button', { name: 'Add block', exact: true })
  // Click outside the plus glyph: the whole control must perform its action.
  await add.click({ position: { x: 3, y: 3 } })
  const suggestions = page.getByRole('listbox', { name: 'Insert block', exact: true })
  await expect(suggestions).toBeVisible()
  await suggestions.getByRole('option', { name: /^Heading 1/ }).click()
  await page.getByLabel('Document body', { exact: true }).pressSequentially('A heading inserted with the plus button')
  const heading = page.locator('.bn-block-content[data-content-type="heading"]')
  await expect(heading).toContainText('A heading inserted with the plus button')
  await expect(paragraph(page, 1)).toBeVisible()
  await saved(page)
  await heading.hover()
  await page.getByRole('button', { name: 'Open block menu', exact: true }).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(heading).toHaveCount(0)
  await expect(paragraph(page, 1)).toBeVisible()
  await expect(paragraph(page, 2)).toBeVisible()
  await saved(page)
  await reveal(page, 2)
  await page.screenshot({ path: info.outputPath('desktop-block-controls.png') })
})

test('block controls retain keyboard activation and native drag behavior', async ({ page, browserName }) => {
  await writeDocument(page, fixture(3))
  await reveal(page, 1)
  const add = page.getByRole('button', { name: 'Add block', exact: true })
  await add.focus()
  await add.press('Space')
  const suggestions = page.getByRole('listbox', { name: 'Insert block', exact: true })
  await expect(suggestions).toBeVisible()
  await page.keyboard.press('Enter')
  const heading = page.locator('.bn-block-content[data-content-type="heading"]')
  await expect(heading).toBeVisible()
  await page.getByLabel('Document body', { exact: true }).pressSequentially('Keyboard inserted heading')
  await heading.hover()
  const drag = page.getByRole('button', { name: 'Open block menu', exact: true })
  await drag.focus()
  await drag.press('Enter')
  const remove = page.getByRole('button', { name: 'Delete', exact: true })
  await expect(remove).toBeFocused()
  await checkActionFocus(page, browserName)
  await page.keyboard.press('Enter')
  await expect(heading).toHaveCount(0)
  await reveal(page, 1)
  const target = paragraph(page, 3)
  await dragBlock(page, drag, target)
  await expect.poll(async () => {
    const body = await page.getByLabel('Document body', { exact: true }).innerText()
    return body.indexOf(blockText(1)) > body.indexOf(blockText(3))
  }).toBe(true)
  await saved(page)
})

test('reduced motion keeps narrow block controls and keyboard operation available', async ({ page, browserName }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 390, height: 740 })
  await writeDocument(page, fixture(3))
  const block = await reveal(page, 2)
  await checkControls(page, block, 'en')
  const drag = page.getByRole('button', { name: 'Open block menu', exact: true })
  expect(await drag.evaluate(element => getComputedStyle(element).transitionDuration)).toBe('0s')
  expect(await drag.evaluate(element => getComputedStyle(element).transitionProperty)).toBe('none')
  await drag.focus()
  await drag.press('Enter')
  const menu = blockActions(page)
  await expect(menu).toBeVisible()
  await withinViewport(page, menu)
  await expect(blockAction(page, 'en', 'remove')).toBeFocused()
  await checkActionFocus(page, browserName)
  await page.keyboard.press('Escape')
  await expect(menu).not.toBeVisible()
  await expect(page.getByLabel('Document body', { exact: true })).toContainText(blockText(2))
})

test('releasing a pointer over the block handle does not open a menu unless the gesture started there', async ({
  page,
}) => {
  await writeDocument(page, fixture(3))
  const block = await reveal(page, 1)
  const handle = page.getByRole('button', { name: 'Open block menu', exact: true })
  const handleBounds = await handle.boundingBox()
  const blockBounds = await block.boundingBox()
  if (handleBounds === null || blockBounds === null) {
    throw new Error('The pointer gesture endpoints are missing')
  }
  await page.mouse.move(blockBounds.x + 2, blockBounds.y + 2)
  await page.mouse.down()
  try {
    await page.mouse.move(
      handleBounds.x + handleBounds.width / 2,
      handleBounds.y + handleBounds.height / 2,
      { steps: 4 },
    )
  }
  finally {
    await page.mouse.up()
  }
  await expect(page.locator('.editor-desktop-block-actions')).toHaveCount(0)
  await expect(handle).toHaveAttribute('aria-expanded', 'false')
  await reveal(page, 1)
  await handle.click()
  const menu = page.locator('.editor-desktop-block-actions')
  await expect(menu).toBeVisible()
  await expect(menu.getByRole('button', { name: 'Delete', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await expect(page.getByLabel('Document body', { exact: true })).toContainText(blockText(1))
  await reveal(page, 1)
  await cancelHandleGestureOutside(page, handle)
  await reveal(page, 2)
  await expect.poll(async () => (await handle.boundingBox())?.y ?? 0)
    .toBeGreaterThan(handleBounds.y + 10)
  await handle.click()
  await expect(menu).toBeVisible()
  await menu.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(paragraph(page, 2)).toHaveCount(0)
  await expect(paragraph(page, 1)).toBeVisible()
  await expect(paragraph(page, 3)).toBeVisible()
  await saved(page)
})

test('resizing across the breakpoint keeps the controls and menu in the viewport', async ({ page, browserName }) => {
  await page.setViewportSize({ width: 700, height: 740 })
  await writeDocument(page, fixture(3))
  for (const width of [
    700,
    701,
    320,
  ]) {
    await page.setViewportSize({ width, height: 740 })
    const block = await reveal(page, 2)
    const add = page.getByRole('button', { name: 'Add block', exact: true })
    await expect.poll(async () => {
      const control = await add.boundingBox()
      const content = await block.boundingBox()
      if (control === null || content === null) {
        return false
      }
      return width <= 700
        ? Math.abs(control.x - content.x) <= 2 && control.y >= content.y + content.height - 1
        : control.x + control.width <= content.x + 1
    }).toBe(true)
    await checkControls(page, block, 'en')
    const drag = page.getByRole('button', { name: 'Open block menu', exact: true })
    await drag.focus()
    await drag.press('Enter')
    const menu = blockActions(page)
    await expect(menu).toBeVisible()
    await withinViewport(page, menu)
    await expect(blockAction(page, 'en', 'remove')).toBeFocused()
    await checkActionFocus(page, browserName)
    await page.keyboard.press('Escape')
    await expect(menu).not.toBeVisible()
    await expect(page.getByLabel('Document body', { exact: true })).toBeFocused()
  }
  await expect(page.getByLabel('Document body', { exact: true })).toContainText(blockText(2))
})

test.describe('touch block actions', () => {
  test.use({ hasTouch: true })
  test('a touch tap opens the block drawer and deletes only its active block at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 })
    await writeDocument(page, fixture(3))
    await paragraph(page, 1).tap()
    const handle = page.getByRole('button', { name: 'Open block menu', exact: true })
    await expect(handle).toBeVisible()
    await withinViewport(page, handle)
    await handle.tap()
    const menu = blockActions(page)
    await expect(menu).toBeVisible()
    await withinViewport(page, menu)
    await blockAction(page, 'en', 'remove').tap()
    await expect(paragraph(page, 1)).toHaveCount(0)
    await expect(paragraph(page, 2)).toBeVisible()
    await expect(paragraph(page, 3)).toBeVisible()
    await saved(page)
  })
})
