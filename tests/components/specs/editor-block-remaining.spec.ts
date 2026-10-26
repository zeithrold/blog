/* eslint-disable max-lines -- The remaining block slice keeps its replacements together. */
import { emptyDocument } from '@/content/document'
import { envelope } from '@/content/envelope'
import {
  blockAction,
  blockActions,
  blockText,
  cancelHandleGestureOutside,
  checkActionFocus,
  checkColorChoices,
  checkControls,
  colorLabels,
  fixture,
  labels,
  openTouchActions,
  openTouchColors,
  paragraph,
  reveal,
  tabToControl,
} from '~/tests/browser/editor/blocks/block-action-helpers'
import {
  documentLayout,
  expectControlsInBlockGap,
  expectMobileBlockSpacing,
  firstNestedGapItem,
  gapDocument,
  hideBlockControls,
} from '~/tests/browser/editor/blocks/mobile-block-gap-helpers'
import { tableDocument } from '~/tests/browser/editor/tables/table-overlay-helpers'
import { assertAccessible } from '~/tests/support/browser/accessibility'
import { withinViewport } from '~/tests/support/browser/layout'
import { expectPacketBlocks } from '../support/editor-block-fixtures'
import { expectActionRows, openActionMenu, openBlockActions } from '../support/editor-block-remaining'
import { flushDraft, revisionCount, savedDocument } from '../support/editor-table-fixtures'
import { expect, test } from '../support/test'

/**
 * The remaining native block interactions on the production editor entry: the
 * real BlockNote editor, its block side menus, the compact action drawer, the
 * slash palette and the document's CSS geometry, mounted with only the HTTP
 * boundary replaced. Typing, hovering, tapping, dragging and keyboard traversal
 * are therefore native here.
 *
 * A case asserts the revision packet the client sent, never a stored document:
 * the real Worker and D1 own the two remaining E2E representatives, which save
 * a chosen block color and an inserted nested structure and read them back after
 * a reload.
 */

/** A paragraph as the revision packet spells it, with the colors a case chose. */
function paragraphPacket(index: number, colors: { textColor: string, backgroundColor: string } = {
  textColor: 'default',
  backgroundColor: 'default',
}) {
  return {
    type: 'paragraph',
    props: { textAlignment: 'left', ...colors },
    content: [
      { type: 'text', text: blockText(index), styles: {} },
    ],
  }
}

for (const width of [320, 390]) {
  for (const locale of ['en', 'zh'] as const) {
    test(`block controls stay reachable without covering text after scrolling at ${width}px in ${locale}`, async ({
      page,
    }) => {
      const { api } = await openBlockActions(page, fixture(24), { width, height: 740, locale })
      try {
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
        await api.expectServed()
      }
      finally {
        await api.dispose()
      }
    })
  }
}

test('reduced motion keeps narrow block controls and keyboard operation available', async ({
  page,
  browserName,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const { api } = await openBlockActions(page, fixture(3), { width: 390, height: 740 })
  try {
    const block = await reveal(page, 2)
    await checkControls(page, block, 'en')
    const handle = page.getByRole('button', { name: labels.en.menu, exact: true })
    expect(await handle.evaluate(element => getComputedStyle(element).transitionDuration)).toBe('0s')
    expect(await handle.evaluate(element => getComputedStyle(element).transitionProperty)).toBe('none')
    await handle.focus()
    await handle.press('Enter')
    const menu = blockActions(page)
    await expect(menu).toBeVisible()
    await withinViewport(page, menu)
    await expect(blockAction(page, 'en', 'remove')).toBeFocused()
    await checkActionFocus(page, browserName)
    await page.keyboard.press('Escape')
    await expect(menu).not.toBeVisible()
    await expect(page.getByLabel(labels.en.body, { exact: true })).toContainText(blockText(2))
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

test('releasing a pointer over the block handle does not open a menu unless the gesture started there', async ({
  page,
}) => {
  const { api } = await openBlockActions(page, fixture(3))
  try {
    const block = await reveal(page, 1)
    const handle = page.getByRole('button', { name: labels.en.menu, exact: true })
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
    await expect(page.getByLabel(labels.en.body, { exact: true })).toContainText(blockText(1))
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
    await flushDraft(page)
    await expectPacketBlocks(api, [
      paragraphPacket(1),
      paragraphPacket(3),
    ])
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

test('resizing across the breakpoint keeps the controls and menu in the viewport', async ({
  page,
  browserName,
}) => {
  const { api } = await openBlockActions(page, fixture(3), { width: 700, height: 740 })
  try {
    for (const width of [
      700,
      701,
      320,
    ]) {
      await page.setViewportSize({ width, height: 740 })
      const block = await reveal(page, 2)
      const add = page.getByRole('button', { name: labels.en.add, exact: true })
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
      const handle = page.getByRole('button', { name: labels.en.menu, exact: true })
      await handle.focus()
      await handle.press('Enter')
      const menu = blockActions(page)
      await expect(menu).toBeVisible()
      await withinViewport(page, menu)
      await expect(blockAction(page, 'en', 'remove')).toBeFocused()
      await checkActionFocus(page, browserName)
      await page.keyboard.press('Escape')
      await expect(menu).not.toBeVisible()
      await expect(page.getByLabel(labels.en.body, { exact: true })).toBeFocused()
    }
    await expect(page.getByLabel(labels.en.body, { exact: true })).toContainText(blockText(2))
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

test.describe('touch color drawer', () => {
  test.use({ hasTouch: true })
  for (const { width, locale } of [
    { width: 320, locale: 'zh' as const },
    { width: 390, locale: 'en' as const },
  ]) {
    test(`touch color drawer fits ${width}px in ${locale} and marks the chosen block colors`, async ({ page }) => {
      const { api, body } = await openBlockActions(page, fixture(3), { width, height: 740, locale })
      try {
        const identity = await body.elementHandle()
        await openTouchActions(page, 2, locale)
        let drawer = await openTouchColors(page, 2, locale)
        await checkColorChoices(drawer, locale)
        await drawer.locator('[data-test="text-color-red"]').tap()
        await expect(paragraph(page, 2)).toHaveAttribute('data-text-color', 'red')
        drawer = await openTouchColors(page, 2, locale)
        await drawer.locator('[data-test="background-color-yellow"]').tap()
        await expect(paragraph(page, 2)).toHaveAttribute('data-background-color', 'yellow')
        drawer = await openTouchColors(page, 2, locale)
        await expect(drawer.locator('[data-test="text-color-red"]')).toHaveAttribute('aria-pressed', 'true')
        await expect(drawer.locator('[data-test="background-color-yellow"]')).toHaveAttribute('aria-pressed', 'true')
        await withinViewport(page, drawer)
        await drawer.getByRole('button', { name: colorLabels[locale].close, exact: true }).tap()
        await expect(drawer).not.toBeVisible()
        await expect(body).toBeFocused()
        expect(await identity.evaluate(element => element.isConnected)).toBe(true)
        await flushDraft(page)
        await expectPacketBlocks(api, [
          paragraphPacket(1),
          paragraphPacket(2, { textColor: 'red', backgroundColor: 'yellow' }),
          paragraphPacket(3),
        ])
        await api.expectServed()
      }
      finally {
        await api.dispose()
      }
    })
  }
})

test('color drawers keep focus and release the editor on Escape and desktop resize', async ({
  page,
  browserName,
}) => {
  const { api, body } = await openBlockActions(page, fixture(3), { width: 320, height: 740 })
  try {
    const identity = await body.elementHandle()
    await reveal(page, 2)
    const handle = page.getByRole('button', { name: labels.en.menu, exact: true })
    await handle.focus()
    await handle.press('Enter')
    const drawer = blockActions(page)
    await expect(blockAction(page, 'en', 'remove')).toBeFocused()
    await tabToControl(page, browserName)
    await expect(blockAction(page, 'en', 'colors')).toBeFocused()
    await page.keyboard.press('Enter')
    const first = drawer.locator('[data-test="text-color-default"]')
    await expect(drawer.getByRole('button', { name: 'Back', exact: true })).toBeFocused()
    await tabToControl(page, browserName)
    await expect(first).toBeFocused()
    const close = drawer.getByRole('button', { name: 'Close', exact: true })
    await close.focus()
    await tabToControl(page, browserName)
    expect(await drawer.evaluate(element => element.contains(document.activeElement))).toBe(true)
    await expect(drawer.getByRole('button', { name: 'Back', exact: true })).toBeFocused()
    await tabToControl(page, browserName, true)
    await expect(close).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(drawer).not.toBeVisible()
    await expect(body).toBeFocused()
    expect(await identity.evaluate(element => element.isConnected)).toBe(true)
    await reveal(page, 2)
    await handle.click()
    await blockAction(page, 'en', 'colors').click()
    await expect(drawer.locator('[data-test="text-color-red"]')).toBeVisible()
    await page.setViewportSize({ width: 1440, height: 1000 })
    await expect(drawer).not.toBeVisible()
    expect(await identity.evaluate(element => element.isConnected)).toBe(true)
    await reveal(page, 2)
    await handle.click()
    const menu = page.locator('.editor-desktop-block-actions')
    await expect(menu).toBeVisible()
    await withinViewport(page, menu)
    await menu.getByRole('button', { name: 'Colors', exact: true }).click()
    await expect(menu).toBeVisible()
    await withinViewport(page, menu)
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
    await expect(body).toContainText(blockText(2))
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

test('desktop block actions show icons and keep matrix color selection and persistence', async ({ page }) => {
  const { api } = await openBlockActions(page, fixture(3))
  try {
    await reveal(page, 2)
    await page.getByRole('button', { name: labels.en.menu, exact: true }).click()
    const menu = page.locator('.editor-desktop-block-actions')
    for (const action of ['Delete', 'Colors']) {
      await expect(menu.getByRole('button', { name: action, exact: true }).locator('svg').first()).toBeVisible()
    }
    await menu.getByRole('button', { name: 'Colors', exact: true }).click()
    await expect(menu).toBeVisible()
    await withinViewport(page, menu)
    await menu.locator('[data-test="text-color-blue"]').click()
    await expect(paragraph(page, 2)).toHaveAttribute('data-text-color', 'blue')
    await flushDraft(page)
    await expectPacketBlocks(api, [
      paragraphPacket(1),
      paragraphPacket(2, { textColor: 'blue', backgroundColor: 'default' }),
      paragraphPacket(3),
    ])
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

test('Chinese slash commands show readable rich content and preserve English search aliases', async ({
  page,
}) => {
  const { api, body } = await openBlockActions(page, emptyDocument(), { width: 320, height: 740, locale: 'zh' })
  try {
    await body.press('/')
    const palette = page.getByRole('listbox', { name: '插入正文块', exact: true })
    await expect(palette.locator('.editor-option-title')).toContainText([
      '提示框',
      '脚注',
      '数学公式',
      '流程图',
      '目录',
      '链接卡片',
      'YouTube 视频',
    ])
    await expect(palette.locator('.editor-suggestions-label').last()).toHaveText('扩展内容')
    await body.pressSequentially('callout')
    const callout = palette.getByRole('option', { selected: true })
    await expect(palette.getByRole('option')).toHaveCount(1)
    await expect(callout.locator('.editor-option-title')).toHaveText('提示框')
    await expect(callout.locator('.editor-option-description')).toHaveText('突出显示补充说明、提示或警告')
    await expect(callout.locator('.editor-option-icon .lucide-info')).toBeVisible()
    await expect(palette).toBeVisible()
    await expect(body).toBeFocused()
    await body.press('Enter')
    await expect(palette).toHaveCount(0)
    await expect(body.locator('.bn-block-content[data-content-type="callout"]')).toBeVisible()
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

for (const width of [
  1440,
  390,
  320,
]) {
  for (const locale of ['en', 'zh'] as const) {
    test(`block action menu rows at ${width}px in ${locale}`, async ({ page, browserName }, info) => {
      const { api } = await openBlockActions(page, tableDocument(), {
        width,
        height: 740,
        locale,
        mode: locale === 'zh' ? 'dark' : 'light',
      })
      try {
        const menu = await openActionMenu(page, locale)
        const list = menu.locator('.editor-block-action-list')
        await expectActionRows(list, width <= 700)
        const keyboardHelp = list.getByText(/Alt\+F10/)
        if (width <= 700) {
          await expect(keyboardHelp).toBeHidden()
        }
        else {
          await expect(keyboardHelp).toBeVisible()
        }
        if (locale === 'en' && width !== 320) {
          await assertAccessible(page, info, { label: `block-action-menu-${width}` })
        }
        const remove = list.getByRole('button', { name: labels[locale].remove, exact: true })
        await expect(remove).toBeFocused()
        await tabToControl(page, browserName)
        const colors = list.getByRole('button', { name: labels[locale].colors, exact: true })
        await expect(colors).toBeFocused()
        await expect(colors).toHaveCSS('outline-style', 'none')
        await expect(colors).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
        const row = list.getByRole('button', { name: locale === 'en' ? 'Header row' : '行标题', exact: true })
        await expect(row).toHaveAttribute('aria-pressed', 'false')
        await tabToControl(page, browserName)
        await expect(row).toBeFocused()
        await page.keyboard.press('Enter')
        await expect(row).toHaveAttribute('aria-pressed', 'true')
        await expect(row.locator('svg')).toHaveCount(2)
        const column = list.getByRole('button', { name: locale === 'en' ? 'Header column' : '列标题', exact: true })
        await column.click()
        await expect(column).toHaveAttribute('aria-pressed', 'true')
        await expect(column.locator('svg')).toHaveCount(2)
        await page.screenshot({ path: info.outputPath(`block-action-menu-${width}-${locale}.png`) })
        await page.keyboard.press('Escape')
        await expect(menu).not.toBeVisible()
        const table = page.getByLabel(labels[locale].body, { exact: true }).locator('table')
        await expect(table.locator('th')).toHaveCount(3)
        await api.expectServed()
      }
      finally {
        await api.dispose()
      }
    })
  }
}

for (const width of [390, 320]) {
  test(`mobile blocks use full width and stable control gaps at ${width}px`, async ({ page }) => {
    const { api } = await openBlockActions(page, gapDocument(), { width, height: 900 })
    try {
      await page.evaluate(async () => await document.fonts.ready)
      await expectMobileBlockSpacing(page)
      const layout = await documentLayout(page)
      for (const index of [1, 4]) {
        const block = await reveal(page, index)
        await expectControlsInBlockGap(page, block)
        expect(await documentLayout(page)).toEqual(layout)
        await hideBlockControls(page)
        expect(await documentLayout(page)).toEqual(layout)
      }
      const nested = firstNestedGapItem(page)
      await nested.evaluate(element => element.scrollIntoView({ block: 'center' }))
      await nested.hover()
      await expectControlsInBlockGap(page, nested)
      expect(await documentLayout(page)).toEqual(layout)
      await hideBlockControls(page)
      expect(await documentLayout(page)).toEqual(layout)
      // Showing and hiding the gap controls is not an edit: no revision is written.
      expect(revisionCount(api)).toBe(0)
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}

test.describe('touch block gap insertion', () => {
  test.use({ hasTouch: true })
  test('the gap add control inserts after its block and deletion preserves its neighbours', async ({ page }) => {
    const document = gapDocument()
    const original = envelope.parse(document).blocks
    const { api } = await openBlockActions(page, document, { width: 320, height: 900 })
    try {
      const insertBefore = revisionCount(api)
      await paragraph(page, 1).tap()
      await expectControlsInBlockGap(page, paragraph(page, 1))
      const add = page.getByRole('button', { name: labels.en.add, exact: true })
      // The outer touch target must work beyond the smaller visible button background.
      await add.tap({ position: { x: 2, y: 2 } })
      const suggestions = page.getByRole('listbox', { name: 'Insert block', exact: true })
      await expect(suggestions).toBeVisible()
      await suggestions.getByRole('option', { name: /^Heading 1/ }).tap()
      await page.getByLabel(labels.en.body, { exact: true }).pressSequentially('Inserted in this gap')
      const inserted = await savedDocument(page, api, insertBefore)
      expect(inserted.blocks).toHaveLength(5)
      expect(inserted.blocks[0]).toEqual(original[0])
      expect(inserted.blocks[1]?.type).toBe('heading')
      expect(inserted.blocks[1]?.content).toEqual([
        { type: 'text', text: 'Inserted in this gap', styles: {} },
      ])
      expect(inserted.blocks.slice(2)).toEqual(original.slice(1))
      const heading = page.locator('.bn-block-content[data-content-type="heading"]')
      await heading.tap()
      await expectControlsInBlockGap(page, heading)
      await page.getByRole('button', { name: labels.en.menu, exact: true }).tap()
      await expect(blockActions(page)).toBeVisible()
      const removeHeading = revisionCount(api)
      await blockAction(page, 'en', 'remove').tap()
      expect((await savedDocument(page, api, removeHeading)).blocks).toEqual(original)
      const nested = firstNestedGapItem(page)
      await nested.tap()
      await expectControlsInBlockGap(page, nested)
      await page.getByRole('button', { name: labels.en.menu, exact: true }).tap()
      const removeNested = revisionCount(api)
      await blockAction(page, 'en', 'remove').tap()
      const expected = structuredClone(original)
      const parent = expected[2]
      if (parent === undefined) {
        throw new Error('The nested action fixture has no parent block')
      }
      parent.children = parent.children.slice(1)
      expect((await savedDocument(page, api, removeNested)).blocks).toEqual(expected)
      await paragraph(page, 1).tap()
      await expectControlsInBlockGap(page, paragraph(page, 1))
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
})
