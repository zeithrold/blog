import { writeDocument } from '~/tests/support/browser/document'
import { fixture } from '~/tests/support/browser/document-fixture'
import { withinViewport } from '~/tests/support/browser/layout'
import { expect, test } from '~/tests/support/browser/test'

test('rapid viewport changes finish at the current selection without stale placement', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width: 701, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await writeDocument(page, fixture('Selected range '.repeat(24)))
  const body = page.getByLabel('Document body', { exact: true })
  await body.focus()
  await body.evaluate(async (element) => {
    await document.fonts.ready
    const node = document.createTreeWalker(element, NodeFilter.SHOW_TEXT).nextNode()
    if (node === null) {
      throw new Error('The resize fixture needs text')
    }
    window.getSelection()?.setBaseAndExtent(node, 0, node, 14)
    document.dispatchEvent(new Event('selectionchange'))
  })
  const bar = page.getByRole('toolbar', { name: 'Formatting', exact: true })
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
  await expect(body.locator('strong')).toHaveText('Selected range')
  await page.screenshot({ path: info.outputPath('formatting-rapid-resize.png') })
  expect(errors).toEqual([])
})
