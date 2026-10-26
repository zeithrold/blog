import {
  expectPacketContent,
  formatSelected,
  formatSuffix,
  openFormattingWorkspace,
  revisionWrites,
  selectRange,
} from '../support/editor-formatting-fixtures'
import { expect, test } from '../support/test'

const text = `${formatSelected}${formatSuffix}`
const phrase = { start: 0, end: formatSelected.length }

test('bold affects only the selected range and undo restores plain text', async ({ page }) => {
  const { api, body } = await openFormattingWorkspace(page, text)
  try {
    await selectRange(page, body, phrase, formatSelected)
    const toolbar = page.getByRole('toolbar', { name: 'Formatting', exact: true })
    await toolbar.getByRole('button', { name: 'Bold', exact: true }).click()
    await expect(body.locator('strong')).toHaveText(formatSelected)
    await expectPacketContent(api, [
      { type: 'text', text: formatSelected, styles: { bold: true } },
      { type: 'text', text: formatSuffix, styles: {} },
    ])
    await page.keyboard.press('ControlOrMeta+z')
    await expect(body.locator('strong')).toHaveCount(0)
    await expect(body).toHaveText(text)
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

test('the colour matrices mark their choice and apply it to the selected range', async ({ page }) => {
  const { api, body } = await openFormattingWorkspace(page, text)
  try {
    await selectRange(page, body, phrase, formatSelected)
    const toolbar = page.getByRole('toolbar', { name: 'Formatting', exact: true })
    await toolbar.getByRole('button', { name: 'Colors', exact: true }).click()
    const colors = page.getByRole('dialog', { name: 'Colors', exact: true })
    await expect(colors).toBeVisible()
    const textColors = colors.locator('[data-color-kind="text"]')
    const backgrounds = colors.locator('[data-color-kind="background"]')
    await expect(textColors.getByRole('button')).toHaveCount(10)
    await expect(backgrounds.getByRole('button')).toHaveCount(10)
    const columns = await textColors.getByRole('button').evaluateAll(buttons => new Set(
      buttons.map(button => Math.round(button.getBoundingClientRect().x)),
    ).size)
    expect(columns).toBe(5)
    await textColors.locator('[data-test="text-color-blue"]').click()
    await backgrounds.locator('[data-test="background-color-yellow"]').click()
    await expect(textColors.locator('[data-test="text-color-blue"]')).toHaveAttribute('aria-pressed', 'true')
    await expect(backgrounds.locator('[data-test="background-color-yellow"]')).toHaveAttribute('aria-pressed', 'true')
    await page.keyboard.press('Escape')
    await expect(colors).not.toBeVisible()
    // The dialog closes back onto the editor so the author keeps typing where the range was.
    await expect(body).toBeFocused()
    await expectPacketContent(api, [
      { type: 'text', text: formatSelected, styles: { textColor: 'blue', backgroundColor: 'yellow' } },
      { type: 'text', text: formatSuffix, styles: {} },
    ])
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
    await expect(body).toHaveText(`${rangeText}${formatSuffix}`)
    // Selection and toolbar placement never write to the draft.
    expect(revisionWrites(api).length).toBeLessThanOrEqual(1)
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})
