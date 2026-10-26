import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { emptyDocument } from '@/content/document'
import { withinViewport } from '~/tests/support/browser/layout'

type Locale = 'en' | 'zh'
export const labels = {
  en: { body: 'Document body', add: 'Add block', menu: 'Open block menu', remove: 'Delete', colors: 'Colors' },
  zh: { body: '正文', add: '添加块', menu: '打开菜单', remove: '删除', colors: '颜色' },
} as const

export function blockText(index: number): string {
  return `Block ${String(index).padStart(2, '0')} — A paragraph with enough words to test editor gutters.`
}

export function fixture(count = 24): ReturnType<typeof emptyDocument> {
  const document = emptyDocument()
  document.meta.title = 'Native block actions'
  document.meta.slug = `block-actions-${crypto.randomUUID()}`
  document.blocks = Array.from({ length: count }, (_, index) => ({
    id: crypto.randomUUID(),
    type: 'paragraph',
    props: { textAlignment: 'left', textColor: 'default', backgroundColor: 'default' },
    content: [
      { type: 'text', text: blockText(index + 1), styles: {} },
    ],
    children: [],
  }))
  return document
}

export function paragraph(page: Page, index: number): Locator {
  return page.locator('.bn-block-content').filter({ hasText: blockText(index) })
}

export async function reveal(page: Page, index: number): Promise<Locator> {
  const block = paragraph(page, index)
  await block.evaluate(async (element) => {
    element.scrollIntoView({ block: 'center', behavior: 'instant' })
    // Deliver the resulting scroll event before hover shows the controls;
    // BlockNote intentionally dismisses them on ancestor scrolling.
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
  })
  const bounds = await block.boundingBox()
  if (bounds === null) {
    throw new Error('The block hover target is missing')
  }
  // Locator hover may scroll again, dismissing the controls after this pointer entry.
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
  await expect(page.locator('.editor-side')).toBeVisible()
  return block
}

export async function checkControls(page: Page, block: Locator, locale: Locale): Promise<void> {
  for (const name of [
    labels[locale].add,
    labels[locale].menu,
  ]) {
    const button = page.getByRole('button', { name, exact: true })
    await expect(button).toBeVisible()
    await withinViewport(page, button)
    await clearOfText(button, block)
    if ((page.viewportSize()?.width ?? 0) <= 700) {
      await checkTouchControl(button, block)
    }
  }
  const handle = page.getByRole('button', { name: labels[locale].menu, exact: true })
  if ((page.viewportSize()?.width ?? 0) <= 700) {
    await expect(handle).not.toHaveAttribute('draggable', 'true')
    await expect(handle).toHaveAttribute('aria-haspopup', 'dialog')
  }
  else {
    await expect(handle).toHaveAttribute('draggable', 'true')
  }
}

export function blockActions(page: Page): Locator {
  return (page.viewportSize()?.width ?? 0) <= 700
    ? page.getByRole('dialog')
    : page.locator('.editor-desktop-block-actions')
}

export function blockAction(page: Page, locale: Locale, action: 'remove' | 'colors'): Locator {
  return blockActions(page).getByRole('button', { name: labels[locale][action], exact: true })
}

export const colorLabels = {
  en: { text: 'Text', background: 'Background', close: 'Close' },
  zh: { text: '文本', background: '背景色', close: '关闭' },
} as const

/**
 * A tap on a block reveals the compact controls; a tap on the handle opens the
 * action drawer, whose bounds must stay inside the phone viewport.
 */
export async function openTouchActions(page: Page, index: number, locale: Locale): Promise<Locator> {
  const block = paragraph(page, index)
  await block.scrollIntoViewIfNeeded()
  await block.tap()
  const handle = page.getByRole('button', { name: labels[locale].menu, exact: true })
  await expect(handle).toBeVisible()
  await withinViewport(page, handle)
  await handle.tap()
  const drawer = blockActions(page)
  await expect(drawer).toBeVisible()
  await expect(drawer.locator('[data-vaul-handle]')).toBeVisible()
  await withinViewport(page, drawer)
  const bounds = await drawer.boundingBox()
  expect(bounds?.width).toBeGreaterThanOrEqual((page.viewportSize()?.width ?? 0) - 4)
  expect(bounds?.height).toBeLessThanOrEqual((page.viewportSize()?.height ?? 0) * 0.9 + 2)
  expect(await drawer.evaluate((element) => {
    const box = element.getBoundingClientRect()
    return Math.abs(box.bottom - window.innerHeight)
  })).toBeLessThanOrEqual(2)
  for (const action of ['remove', 'colors'] as const) {
    const button = blockAction(page, locale, action)
    await expect(button.locator('svg').first()).toBeVisible()
    expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(44)
  }
  await expect(page.locator('.editor-desktop-block-actions')).toHaveCount(0)
  return drawer
}

/** Opens the color page of the open drawer: the same drawer, never a second dialog. */
export async function openTouchColors(page: Page, index: number, locale: Locale): Promise<Locator> {
  const drawer = blockActions(page)
  if (!await drawer.isVisible()) {
    await openTouchActions(page, index, locale)
  }
  const colors = blockAction(page, locale, 'colors')
  if (await colors.isVisible()) {
    await colors.tap()
  }
  await expect(drawer.locator('[data-test="text-color-red"]')).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(1)
  await expect(page.locator('.bn-color-picker-dropdown')).toHaveCount(0)
  await withinViewport(page, drawer)
  return drawer
}

/** Two named color groups of ten swatches, every swatch a real touch target. */
export async function checkColorChoices(drawer: Locator, locale: Locale): Promise<void> {
  const text = drawer.getByRole('group', { name: colorLabels[locale].text, exact: true })
  const background = drawer.getByRole('group', { name: colorLabels[locale].background, exact: true })
  await expect(text).toBeVisible()
  await expect(background).toBeVisible()
  await expect(text.locator('[data-test^="text-color-"]')).toHaveCount(10)
  await expect(background.locator('[data-test^="background-color-"]')).toHaveCount(10)
  for (const color of await drawer.locator('[data-test*="-color-"]').all()) {
    const size = await color.boundingBox()
    expect(size?.width).toBeGreaterThanOrEqual(44)
    expect(size?.height).toBeGreaterThanOrEqual(44)
  }
}

export async function tabToControl(page: Page, browserName: string, backward = false): Promise<void> {
  // Safari's default keyboard policy requires Option+Tab to include buttons.
  const keys = `${browserName === 'webkit' ? 'Alt+' : ''}${backward ? 'Shift+' : ''}Tab`
  await page.keyboard.press(keys)
}

export async function checkActionFocus(page: Page, browserName: string): Promise<void> {
  await tabToControl(page, browserName)
  await expect(blockAction(page, 'en', 'colors')).toBeFocused()
  await tabToControl(page, browserName, true)
  await expect(blockAction(page, 'en', 'remove')).toBeFocused()
}

export async function dragBlock(page: Page, handle: Locator, target: Locator): Promise<void> {
  await expect(handle).toBeVisible()
  await expect(target).toBeVisible()
  const sourceBounds = await handle.boundingBox()
  const targetBounds = await target.boundingBox()
  if (sourceBounds === null || targetBounds === null) {
    throw new Error('The native drag endpoints are missing')
  }
  const source = { x: sourceBounds.x + sourceBounds.width / 2, y: sourceBounds.y + sourceBounds.height / 2 }
  const destination = { x: targetBounds.x + 20, y: targetBounds.y + targetBounds.height - 1 }
  await page.mouse.move(source.x, source.y)
  await page.mouse.down()
  try {
    // Start dragging while still over the handle so the active block cannot change first.
    await page.mouse.move(source.x + 8, source.y, { steps: 4 })
    await expect(page.locator('.editor-desktop-block-actions')).toHaveCount(0)
    await page.mouse.move(destination.x, destination.y, { steps: 8 })
    // WebKit needs a second movement at the destination to deliver dragover.
    await page.mouse.move(destination.x, destination.y + 1)
    await expect(page.locator('.editor-desktop-block-actions')).toHaveCount(0)
  }
  finally {
    await page.mouse.up()
  }
  await expect(page.locator('.editor-desktop-block-actions')).toHaveCount(0)
}

export async function cancelHandleGestureOutside(page: Page, handle: Locator): Promise<void> {
  await expect(handle).toBeVisible()
  const bounds = await handle.boundingBox()
  if (bounds === null) {
    throw new Error('The block handle is missing')
  }
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
  await page.mouse.move(center.x, center.y)
  await page.mouse.down()
  try {
    await page.mouse.move(center.x + 8, center.y, { steps: 4 })
    await page.mouse.move(8, 8, { steps: 8 })
    await page.mouse.move(9, 8)
  }
  finally {
    await page.mouse.up()
  }
  await expect(page.locator('.editor-desktop-block-actions')).toHaveCount(0)
}

async function clearOfText(button: Locator, block: Locator): Promise<void> {
  const control = await button.boundingBox()
  const text = await block.evaluate((element) => {
    const range = document.createRange()
    range.selectNodeContents(element.querySelector('.bn-inline-content') ?? element)
    const firstLine = range.getClientRects()[0]
    if (firstLine === undefined) {
      throw new Error('The target paragraph has no visible text')
    }
    return { left: firstLine.left, right: firstLine.right, top: firstLine.top, bottom: firstLine.bottom }
  })
  expect(control).not.toBeNull()
  if (control === null) {
    throw new Error('The block control is missing')
  }
  const intersects = control.x < text.right - 1 && control.x + control.width > text.left + 1
    && control.y < text.bottom - 1 && control.y + control.height > text.top + 1
  expect(intersects).toBe(false)
}

async function checkTouchControl(button: Locator, block: Locator): Promise<void> {
  const control = await button.boundingBox()
  const content = await block.boundingBox()
  if (control === null || content === null) {
    throw new Error('The mobile control or target block has no visible bounds')
  }
  expect(control.width).toBeGreaterThanOrEqual(44)
  expect(control.height).toBeGreaterThanOrEqual(44)
  await expect.poll(async () => {
    const [currentControl, currentContent] = await Promise.all([
      button.boundingBox(),
      block.boundingBox(),
    ])
    return currentControl === null || currentContent === null
      ? Number.NEGATIVE_INFINITY
      : currentControl.y - currentContent.y - currentContent.height
  }).toBeGreaterThanOrEqual(-1)
}
