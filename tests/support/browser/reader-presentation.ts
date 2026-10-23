import type { Locator } from '@playwright/test'
import { expect } from './test'

export async function readerTypography(root: Locator): Promise<void> {
  const typography = await root.evaluate(element => ({
    sans: getComputedStyle(element).getPropertyValue('--ztd-font-sans').replaceAll('"', '').trim(),
    mono: getComputedStyle(element).getPropertyValue('--ztd-font-mono').replaceAll('"', '').trim(),
    body: Number.parseFloat(getComputedStyle(element).fontSize),
  }))
  for (const heading of await root.locator('[id^="block-"] > :is(h2,h3,h4)').all()) {
    expect(await family(heading)).toBe(typography.sans)
    const size = await heading.evaluate(element => Number.parseFloat(getComputedStyle(element).fontSize))
    expect(size).toBeGreaterThan(typography.body * 1.15)
    const leading = await heading.evaluate(element => Number.parseFloat(getComputedStyle(element).lineHeight))
    expect(leading).toBeCloseTo(size * 1.35, 2)
  }
  for (const list of await root.locator('ul, ol').all()) {
    const style = await list.evaluate((element) => {
      if (element.classList.contains('task-list')) {
        return 'none'
      }
      return element.tagName === 'OL' ? 'decimal' : 'disc'
    })
    await expect(list).toHaveCSS('list-style-type', style)
  }
  for (const code of await root.locator('pre[data-language]').all()) {
    expect(await family(code)).toBe(typography.mono)
    await expect(code).toHaveCSS('font-size', '14px')
    await expect(code).toHaveCSS('white-space', 'pre')
    await expect(code).toHaveCSS('overflow-wrap', 'normal')
    await expect(code).toHaveCSS('overflow-x', 'auto')
  }
}

async function family(locator: Locator): Promise<string> {
  // CSSOM may omit optional quotes around family names such as SFMono-Regular.
  return await locator.evaluate(element => getComputedStyle(element).fontFamily.replaceAll('"', ''))
}

export async function readerCodeColors(code: Locator): Promise<void> {
  await expect.poll(async () => new Set(await code.locator('.reader-code-token').evaluateAll(elements =>
    elements.map(element => getComputedStyle(element).color))).size).toBeGreaterThan(2)
}
