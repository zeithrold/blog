/* eslint-disable style/max-len -- Verbatim legacy case titles stay on one line. */
/* eslint-disable max-lines -- One matrix keeps the exact keys of browser-specific formatting residuals. */
import { assertAccessible } from '~/tests/support/browser/accessibility'
import { horizontalBounds, withinViewport } from '~/tests/support/browser/layout'
import {
  expectFormattingPosition,
  formattingToolbar,
  longParagraphs,
  longParagraphText,
  openFormatting,
  remainingCopy,
  repeatedParagraphs,
  selectAcrossBlocks,
  selectLeadingRange,
  tabToControl,
} from '../support/editor-format-remaining'
import { formatSelected, formatSuffix } from '../support/editor-formatting-fixtures'
import { expect, test } from '../support/test'

const phrase = `${formatSelected}${formatSuffix}`
const phraseLength = formatSelected.length

// Keep measured toolbar geometry at each former width/locale. DOM owns control
// inventory, formatting effects and request shape; retained E2E cases own reload.
for (const width of [
  320,
  390,
  700,
  701,
  1440,
]) {
  for (const locale of ['en', 'zh'] as const) {
    test(`floating formatting is bounded at ${width}px in ${locale} and bold affects only its selected range`, async ({ page }) => {
      await page.setViewportSize({ width, height: 740 })
      const { api, body } = await openFormatting(page, repeatedParagraphs(phrase, 1), locale)
      try {
        await selectLeadingRange(page, body, phraseLength, formatSelected)
        const bar = formattingToolbar(page, locale)
        await expect.poll(async () => await page.evaluate(() => window.getSelection()?.toString()))
          .toBe(formatSelected)
        await expect(bar).toBeVisible()
        await horizontalBounds(page, bar)
        const bounds = await bar.boundingBox()
        expect(bounds?.width).toBeLessThanOrEqual(Math.min(640, width - 24) + 1)
        if (width <= 700) {
          const row: number[] = []
          for (const name of [
            remainingCopy[locale].type,
            remainingCopy[locale].bold,
            remainingCopy[locale].italic,
            remainingCopy[locale].underline,
            remainingCopy[locale].more,
          ]) {
            const button = await bar.getByRole('button', { name, exact: true }).boundingBox()
            expect(button?.width).toBeGreaterThanOrEqual(44)
            expect(button?.height).toBeGreaterThanOrEqual(44)
            if (button !== null) {
              row.push(button.y)
            }
          }
          expect(Math.max(...row) - Math.min(...row)).toBeLessThanOrEqual(1)
        }
        await api.expectServed()
      }
      finally {
        await api.dispose()
      }
    })
  }
}

for (const scenario of [
  { width: 320, locale: 'zh' },
  { width: 390, locale: 'en' },
] as const) {
  test(`mobile advanced formatting preserves selection and native actions at ${scenario.width}px`, async ({ page, browserName }) => {
    const { width, locale } = scenario
    const copy = remainingCopy[locale]
    await page.setViewportSize({ width, height: 740 })
    const { api, body } = await openFormatting(page, repeatedParagraphs(phrase, 1), locale)
    try {
      await selectLeadingRange(page, body, phraseLength, formatSelected)
      const more = formattingToolbar(page, locale).getByRole('button', { name: copy.more, exact: true })
      await more.click()
      const drawer = page.getByRole('dialog', { name: copy.drawer, exact: true })
      await drawer.waitFor({ state: 'visible' })
      await horizontalBounds(page, drawer)
      await page.keyboard.press('Escape')
      await drawer.waitFor({ state: 'hidden' })
      await expect.poll(async () => await page.evaluate(() => window.getSelection()?.toString()))
        .toBe(formatSelected)
      await expect(body).toBeFocused()

      await more.focus()
      await more.press('Enter')
      const keyboardDrawer = page.getByRole('dialog', { name: copy.drawer, exact: true })
      const close = keyboardDrawer.getByRole('button', { name: copy.close, exact: true })
      await expect(close).toBeFocused()
      await tabToControl(page, browserName)
      const strike = keyboardDrawer.getByRole('button', { name: copy.strike, exact: true })
      await expect(strike).toBeFocused()
      await page.keyboard.press('Enter')
      await keyboardDrawer.waitFor({ state: 'hidden' })
      const struck = body.locator('s')
      await expect(struck).toHaveCount(1)
      await expect(struck).toHaveText(formatSelected)
      await expect(body).toHaveText(phrase)

      await more.click()
      const colorDrawer = page.getByRole('dialog', { name: copy.drawer, exact: true })
      await colorDrawer.waitFor({ state: 'visible' })
      await horizontalBounds(page, colorDrawer)
      await colorDrawer.getByRole('button', { name: copy.colors, exact: true }).click()
      const colors = page.getByRole('dialog', { name: copy.colors, exact: true })
      const blue = colors.locator('[data-test="text-color-blue"]')
      await horizontalBounds(page, blue)
      const blueBounds = await blue.boundingBox()
      expect(blueBounds?.width).toBeGreaterThanOrEqual(44)
      expect(blueBounds?.height).toBeGreaterThanOrEqual(44)
      // The color page is a dialog named Colors; its own Close exits the sub-page.
      await colors.getByRole('button', { name: copy.close, exact: true }).click()
      await colors.waitFor({ state: 'hidden' })

      // This reselect only prepares the following Link entry; it does not test range retention through a color click.
      await selectLeadingRange(page, body, phraseLength, formatSelected)
      await formattingToolbar(page, locale)
        .getByRole('button', { name: copy.more, exact: true })
        .click()
      await page.getByRole('dialog', { name: copy.drawer, exact: true })
        .getByRole('button', { name: copy.link, exact: true })
        .click()
      const url = page.getByRole('textbox', { name: copy.url, exact: true })
      await url.waitFor({ state: 'visible' })
      await horizontalBounds(page, url)
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}

test('crossing the mobile breakpoint releases its drawer and retains the editor selection', async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 740 })
  const { api, body } = await openFormatting(page, repeatedParagraphs(phrase, 1))
  try {
    await selectLeadingRange(page, body, phraseLength, formatSelected)
    await formattingToolbar(page, 'en')
      .getByRole('button', { name: remainingCopy.en.more, exact: true })
      .click()
    const drawer = page.getByRole('dialog', { name: remainingCopy.en.drawer, exact: true })
    await drawer.waitFor({ state: 'visible' })
    await horizontalBounds(page, drawer)
    await page.setViewportSize({ width: 701, height: 740 })
    await expect.poll(async () => await page.evaluate(() => window.getSelection()?.toString()))
      .toBe(formatSelected)
    const wideToolbar = formattingToolbar(page, 'en')
    await horizontalBounds(page, wideToolbar)
    expect((await wideToolbar.boundingBox())?.width).toBeLessThanOrEqual(Math.min(640, 701 - 24) + 1)
    await page.setViewportSize({ width: 700, height: 740 })
    await expect.poll(async () => await page.evaluate(() => window.getSelection()?.toString()))
      .toBe(formatSelected)
    const compactToolbar = formattingToolbar(page, 'en')
    await horizontalBounds(page, compactToolbar)
    expect((await compactToolbar.boundingBox())?.width).toBeLessThanOrEqual(Math.min(640, 700 - 24) + 1)
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

test.describe('formatting accessibility scanner', () => {
  test.use({ bypassCSP: true })
  test.beforeEach(async ({ context }) => {
    await context.route('https://fonts.googleapis.com/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/css',
        headers: { 'access-control-allow-origin': '*' },
        body: '/* Scanner contexts use system font fallbacks. */',
      })
    })
  })
  for (const scenario of [
    { width: 320, locale: 'zh' },
    { width: 1440, locale: 'en' },
  ] as const) {
    test(`formatting controls are accessible at ${scenario.width}px in ${scenario.locale}`, async ({ page }, info) => {
      const { width, locale } = scenario
      await page.setViewportSize({ width, height: 740 })
      await page.emulateMedia({ reducedMotion: 'reduce' })
      const { api, body } = await openFormatting(page, repeatedParagraphs(phrase, 1), locale)
      try {
        await selectLeadingRange(page, body, phraseLength, formatSelected)
        await expect(formattingToolbar(page, locale).locator('..')).toHaveCSS('transition-duration', '0s')
        await assertAccessible(page, info, { label: `format-toolbar-${width}-${locale}` })
        if (width <= 700) {
          await formattingToolbar(page, locale)
            .getByRole('button', { name: remainingCopy[locale].more, exact: true })
            .click()
          const drawer = page.getByRole('dialog', { name: remainingCopy[locale].drawer, exact: true })
          await drawer.waitFor({ state: 'visible' })
          await horizontalBounds(page, drawer)
          await expect.poll(async () => await drawer.evaluate(element => getComputedStyle(element).animationDuration))
            .toBe('0s')
          await assertAccessible(page, info, { label: `format-options-${width}-${locale}` })
        }
        await api.expectServed()
      }
      finally {
        await api.dispose()
      }
    })
  }
})

for (const width of [
  700,
  701,
  1024,
]) {
  test(`formatting follows multiline and backward cross-block selections at ${width}px`, async ({ page }, info) => {
    const locale = width === 701 ? 'zh' : 'en'
    const mode = width === 701 ? 'dark' : 'light'
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: width === 701 ? 'reduce' : 'no-preference' })
    const { api, body } = await openFormatting(page, longParagraphs(), locale, mode)
    try {
      const bar = formattingToolbar(page, locale)
      await body.locator('.bn-inline-content').nth(8).evaluate(element => element.scrollIntoView({ block: 'center' }))
      await selectAcrossBlocks(body, 8, false)
      await expectFormattingPosition(page, bar)
      const first = await bar.boundingBox()
      expect(first).not.toBeNull()
      await selectAcrossBlocks(body, 9, true)
      await expectFormattingPosition(page, bar)
      const selection = await page.evaluate(() => window.getSelection()?.toString())
      expect(selection?.length).toBeGreaterThan(200)
      await page.evaluate(() => window.scrollBy(0, 45))
      await expectFormattingPosition(page, bar)
      const resized = width === 700 ? 701 : 700
      await page.setViewportSize({ width: resized, height: 900 })
      await expectFormattingPosition(page, bar)
      await expect.poll(async () => {
        const bounds = await bar.boundingBox()
        const header = await page.locator('.workspace-header').boundingBox()
        return bounds !== null && header !== null ? bounds.y - header.y - header.height : -1
      }).toBeGreaterThanOrEqual(7)
      expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(selection)
      await assertAccessible(page, info, { label: `formatting-position-${width}` })
      await page.keyboard.press('Escape')
      await expect(bar).not.toBeVisible()
      await expect(body).toBeFocused()
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}

test.describe('native virtual keyboard branch', () => {
  test.use({ isMobile: true, hasTouch: true, viewport: { width: 390, height: 900 } })
  test('keyboard viewport keeps the native toolbar and returns to selection positioning', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 1 })
    })
    const { api, body } = await openFormatting(page, repeatedParagraphs(longParagraphText, 1))
    try {
      await body.focus()
      await body.evaluate(async (element) => {
        await document.fonts.ready
        const paragraph = element.querySelector('.bn-inline-content')
        const node = paragraph === null ? null : document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT).nextNode()
        if (node === null) {
          throw new Error('The keyboard fixture needs text')
        }
        window.getSelection()?.setBaseAndExtent(node, 0, node, 11)
        document.dispatchEvent(new Event('selectionchange'))
      })
      const bar = formattingToolbar(page, 'en')
      await expectFormattingPosition(page, bar)
      await page.evaluate(() => {
        Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 550 })
        window.visualViewport?.dispatchEvent(new Event('resize'))
      })
      const keyboardBar = page.locator('.bn-mobile-formatting-toolbar')
      await expect(keyboardBar).toBeVisible()
      await horizontalBounds(page, keyboardBar)
      await keyboardBar.getByRole('button', { name: 'Bold', exact: true }).tap()
      const bold = body.locator('strong')
      await expect(bold).toHaveCount(1)
      await expect(bold).toHaveText('A selection')
      await expect(body).toHaveText(longParagraphText)
      await page.evaluate(() => {
        Reflect.deleteProperty(window.visualViewport ?? {}, 'height')
        window.visualViewport?.dispatchEvent(new Event('resize'))
      })
      await expect(keyboardBar).toHaveCount(0)
      await expectFormattingPosition(page, bar)
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
})

test('refocusing during the close animation measures the retained selection again', async ({ page }) => {
  await page.setViewportSize({ width: 701, height: 900 })
  const { api, body } = await openFormatting(page, longParagraphs())
  try {
    const bar = formattingToolbar(page, 'en')
    await body.locator('.bn-inline-content').nth(8).evaluate(element => element.scrollIntoView({ block: 'center' }))
    await selectAcrossBlocks(body, 8, false)
    await expectFormattingPosition(page, bar)
    const selection = await page.evaluate(() => window.getSelection()?.toString())
    const title = await page.locator('.title-field input').elementHandle()
    await body.evaluate(async (element, titleField) => {
      if (!(titleField instanceof HTMLElement)) {
        throw new TypeError('The refocus fixture needs a title field')
      }
      titleField.focus({ preventScroll: true })
      await new Promise(requestAnimationFrame)
      window.scrollBy(0, 45)
      await new Promise(requestAnimationFrame)
      element.focus({ preventScroll: true })
    }, title)
    await expectFormattingPosition(page, bar)
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(selection)
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

test('rapid viewport changes finish at the current selection without stale placement', async ({ page }) => {
  await page.setViewportSize({ width: 701, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const { api, body } = await openFormatting(page, repeatedParagraphs('Selected range '.repeat(24), 1))
  try {
    await body.focus()
    await body.evaluate(async (element) => {
      await document.fonts.ready
      const inline = element.querySelector('.bn-inline-content')
      const node = inline === null ? null : document.createTreeWalker(inline, NodeFilter.SHOW_TEXT).nextNode()
      if (node === null) {
        throw new Error('The resize fixture needs text')
      }
      window.getSelection()?.setBaseAndExtent(node, 0, node, 14)
      document.dispatchEvent(new Event('selectionchange'))
    })
    const bar = formattingToolbar(page, 'en')
    await expect(bar).toBeVisible()
    for (const width of [
      1024,
      700,
      701,
      390,
      1440,
      701,
    ]) {
      await page.setViewportSize({ width, height: 900 })
    }
    await expect(bar.locator('..')).toHaveCSS('opacity', '1')
    await withinViewport(page, bar)
    await expect.poll(async () => await bar.evaluate((element) => {
      const selected = window.getSelection()?.getRangeAt(0).getBoundingClientRect()
      const header = document.querySelector('.workspace-header')?.getBoundingClientRect()
      const bounds = element.getBoundingClientRect()
      return selected !== undefined && header !== undefined && bounds.top >= header.bottom + 7
        && Math.min(Math.abs(bounds.bottom - selected.top), Math.abs(bounds.top - selected.bottom)) < 20
    })).toBe(true)
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe('Selected range')
    await bar.getByRole('button', { name: 'Bold', exact: true }).click()
    const bold = body.locator('strong')
    await expect(bold).toHaveCount(1)
    await expect(bold).toHaveText('Selected range')
    await expect(body).toHaveText('Selected range '.repeat(24))
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})
