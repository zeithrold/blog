import {
  formatSelected,
  formatSuffix,
  openFormattingWorkspace,
  selectRange,
} from '../support/editor-formatting-fixtures'
import { expect, test } from '../support/test'

const text = `${formatSelected}${formatSuffix}`
const phrase = { start: 0, end: formatSelected.length }

test('the colour matrices mark their choice and apply it to the selected range', async ({ page }) => {
  const { api, body } = await openFormattingWorkspace(page, text)
  try {
    await selectRange(page, body, phrase, formatSelected)
    const toolbar = page.getByRole('toolbar', { name: 'Formatting', exact: true })
    await toolbar.getByRole('button', { name: 'Colors', exact: true }).click()
    const colors = page.getByRole('dialog', { name: 'Colors', exact: true })
    const textColors = colors.locator('[data-color-kind="text"]')
    const columns = await textColors.getByRole('button').evaluateAll(buttons => new Set(
      buttons.map(button => Math.round(button.getBoundingClientRect().x)),
    ).size)
    expect(columns).toBe(5)
    await textColors.locator('[data-test="text-color-blue"]').click()
    await colors.locator('[data-color-kind="background"] [data-test="background-color-yellow"]').click()
    await page.keyboard.press('Escape')
    await expect(colors).not.toBeVisible()
    await expect(body).toBeFocused()
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

const rangeText = 'Keyboard range'

test(`fourteen Shift+ArrowRight presses retain the complete selection and a bounded toolbar`, async ({ page }) => {
  await page.setViewportSize({ width: 701, height: 740 })
  const { api, body } = await openFormattingWorkspace(page, `${rangeText}${formatSuffix}`)
  try {
    await selectRange(page, body, { start: 0, end: 0 }, '')
    await expect(body).toBeFocused()
    expect(rangeText).toHaveLength(14)
    for (let index = 0; index < rangeText.length; index++) {
      await page.keyboard.press('Shift+ArrowRight')
    }
    await expect.poll(async () => await page.evaluate(() => window.getSelection()?.toString()))
      .toBe(rangeText)
    const toolbar = page.getByRole('toolbar', { name: 'Formatting', exact: true })
    await expect(toolbar).toBeVisible()
    const bounds = await toolbar.boundingBox()
    expect(bounds?.width).toBeLessThanOrEqual(Math.min(640, 701 - 24) + 1)
    expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(701)
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})
