import type { Locator, Page } from '@playwright/test'
import {
  coloredTokens,
  expectSavedCode,
  openCodeWorkspace,
} from '../support/editor-code-fixtures'
import { expect, test } from '../support/test'

const pythonSource = 'def greet(name):\n    return "hello" + name'

async function chooseTheme(page: Page, theme: 'Light' | 'Dark'): Promise<void> {
  await page.getByRole('button', { name: 'Appearance', exact: true }).click()
  await page.getByRole('menuitemradio', { name: theme, exact: true }).click()
  await expect(page.getByRole('menu', { name: 'Appearance', exact: true })).toHaveCount(0)
}

// Live highlighting rewrites the block's inline spans, so a caret that only exists in the
// browser can be put back where ProseMirror recorded it when a re-highlight lands before the
// next input. Click where the text has to end and prove the caret is there.
async function clickAtTextEnd(code: Locator): Promise<void> {
  const token = code.locator('.shiki').last()
  const box = await token.boundingBox()
  expect(box).not.toBeNull()
  await token.click({ position: { x: (box?.width ?? 0) - 1, y: (box?.height ?? 0) / 2 } })
}

async function caretOffset(code: Locator): Promise<number> {
  return await code.evaluate((element) => {
    const selection = window.getSelection()
    const anchor = selection?.anchorNode ?? null
    if (selection === null || anchor === null || selection.rangeCount === 0
      || !element.contains(anchor)) {
      return -1
    }
    const range = document.createRange()
    range.selectNodeContents(element)
    range.setEnd(anchor, selection.anchorOffset)
    return range.toString().length
  })
}

test('code highlighting paints native tokens and follows the editor color mode', async ({ page }) => {
  const { api, code } = await openCodeWorkspace(page, { language: 'python', source: pythonSource })
  const identity = await code.elementHandle()
  try {
    await coloredTokens(code)
    const keyword = code.locator('.shiki').filter({ hasText: /^def$/ })
    await expect(keyword).toHaveCount(1)
    const light = await keyword.evaluate(element => getComputedStyle(element).color)
    await chooseTheme(page, 'Dark')
    await expect.poll(async () => await keyword.evaluate(element => getComputedStyle(element).color))
      .not
      .toBe(light)
    // The block keeps its element while the highlighter repaints it for the new mode.
    expect(await identity.evaluate(element => element.isConnected)).toBe(true)
    await chooseTheme(page, 'Light')
    await expect(keyword).toHaveCSS('color', light)
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

test('native undo and redo keep the highlighted code source', async ({ page }) => {
  const { api, code } = await openCodeWorkspace(page, { language: 'python', source: pythonSource })
  try {
    await expect(code.locator('.shiki').last()).toBeAttached()
    await clickAtTextEnd(code)
    await expect.poll(async () => await caretOffset(code)).toBe(pythonSource.length)
    await page.keyboard.insertText(' # edited')
    await expect(code).toHaveText(`${pythonSource} # edited`)
    await expect(code.locator('.shiki').filter({ hasText: '# edited' })).toBeVisible()
    await expectSavedCode(api, { language: 'python', text: `${pythonSource} # edited` })
    await page.keyboard.press('ControlOrMeta+z')
    await expect(code).toHaveText(pythonSource)
    await page.keyboard.press('ControlOrMeta+Shift+z')
    await expect(code).toHaveText(`${pythonSource} # edited`)
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

test('native IME composition keeps the code caret and its source', async ({ page }) => {
  const { api, body, code } = await openCodeWorkspace(page, { language: 'python', source: pythonSource })
  try {
    await expect(code.locator('.shiki').last()).toBeAttached()
    await clickAtTextEnd(code)
    const allowed = await body.evaluate((element) => {
      const event = new CompositionEvent('compositionstart', { bubbles: true, cancelable: true, data: '' })
      element.dispatchEvent(event)
      return !event.defaultPrevented
    })
    expect(allowed).toBe(true)
    await page.keyboard.insertText(' 中文')
    await body.dispatchEvent('compositionend', { data: '中文' })
    const edited = `${pythonSource} 中文`
    await expect(code).toHaveText(edited)
    expect(await code.evaluate(element =>
      element.contains(window.getSelection()?.anchorNode ?? null))).toBe(true)
    await coloredTokens(code)
    await expectSavedCode(api, { language: 'python', text: edited })
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

for (const width of [1440, 390]) {
  test(`the code language select keeps compact geometry with a truthful value at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const { api, selector } = await openCodeWorkspace(page)
    try {
      const bounds = await selector.boundingBox()
      expect(bounds?.height).toBeGreaterThanOrEqual(32)
      expect(bounds?.height).toBeLessThanOrEqual(44)
      expect(bounds?.width).toBeLessThanOrEqual(160)
      expect((bounds?.x ?? -1) + (bounds?.width ?? 0)).toBeLessThanOrEqual(width)
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}
