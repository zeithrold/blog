import { saved, writeDocument } from '~/tests/support/browser/document'
import { expect, test } from '~/tests/support/browser/test'
import { richDocument } from './rich-fixture'

test('rich native schema saves, bibliography renders and opaque diagrams work in private and public views', async ({
  page,
}, info) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text())
    }
  })
  const document = richDocument()
  await writeDocument(page, document)
  await expect(page.getByRole('button', { name: 'Citation reference', exact: true })).toHaveText('[1, p. 3]')
  await expect(page.getByLabel('Document body', { exact: true })
    .getByRole('button', { name: 'Footnote reference', exact: true })).toHaveText('1')
  await verifyCitationSearch(page)
  await page.getByRole('combobox', { name: 'Callout tone', exact: true }).click()
  await page.getByRole('option', { name: 'warning', exact: true }).click()
  await page.locator('[data-inline-content-type="inlineMath"]')
    .getByRole('button', { name: 'Edit formula', exact: true })
    .click()
  await page.getByRole('dialog', { name: 'Edit formula', exact: true })
    .getByLabel('Formula source', { exact: true })
    .fill('x^3')
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await saved(page)
  await expect(page.locator('math')).toHaveCount(2)
  await page.locator('[data-content-type="mermaid"]').scrollIntoViewIfNeeded()
  const editorFrame = page.frameLocator('iframe[title="Safe diagram"]')
  await expect(editorFrame.locator('svg')).toBeVisible({ timeout: 15000 })
  expect(await page.locator('iframe').getAttribute('sandbox')).toBe('allow-scripts')
  await page.getByRole('button', { name: 'Publish' }).click()
  await expect(page.getByText('Published', { exact: true })).toBeVisible()
  await page.goto(`/posts/${document.meta.slug}`)
  await expect(page.getByText('Source book', { exact: true })).toBeVisible()
  await expect(page.locator('.reader .callout')).toHaveAttribute('data-tone', 'warning')
  await expect(page.locator('math')).toHaveCount(2)
  await diagram(page)
  const json = await page.locator('script[type="application/ld+json"]').textContent()
  expect(json).toContain('BlogPosting')
  expect(errors).toEqual([])
  // WebKit screenshot preparation injects `body {}` without a CSP nonce.
  await page.screenshot({ path: info.outputPath('rich-reader.png') })
})
async function diagram(page: import('@playwright/test').Page): Promise<void> {
  await page.locator('.diagram').scrollIntoViewIfNeeded()
  const frame = page.frameLocator('iframe[title="Safe diagram"]')
  await expect(frame.locator('svg')).toBeVisible({ timeout: 15000 })
  expect(await page.locator('iframe').getAttribute('sandbox')).toBe('allow-scripts')
  const child = page.frames().find(item => item.parentFrame() !== null)
  expect(child).toBeDefined()
  const parentBlocked = await child?.evaluate(() => {
    try {
      return window.parent.document.cookie === 'not reachable'
    }
    catch {
      return true
    }
  })
  expect(parentBlocked).toBe(true)
}

async function verifyCitationSearch(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('button', { name: 'Citation reference', exact: true }).click()
  const search = page.getByRole('searchbox', { name: 'Search references', exact: true })
  const selection = page.getByRole('combobox', { name: 'Citation reference', exact: true })
  await search.fill('author')
  await selection.click()
  await expect(page.getByRole('option', { name: 'Source book', exact: true })).toBeVisible()
  await expect(page.getByRole('option', { name: 'Other source', exact: true })).toHaveCount(0)
  await page.getByRole('option', { name: 'Source book', exact: true }).click()
  await expect(selection).toHaveText('Source book')
  await search.fill('not a reference')
  await expect(page.getByText('No references match this search.', { exact: true })).toBeVisible()
  await expect(selection).toHaveText('Source book (Current selection)')
  await selection.click()
  await expect(page.getByRole('option', { name: 'Source book (Current selection)', exact: true }))
    .toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('option', { name: 'Other source', exact: true })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(selection).toBeFocused()
  await search.clear()
  await expect(page.getByText('No references match this search.', { exact: true })).toHaveCount(0)
  await expect(selection).toHaveText('Source book')
  await selection.click()
  await expect(page.getByRole('option', { name: 'Other source', exact: true })).toBeVisible()
  await page.getByRole('option', { name: 'Other source', exact: true }).click()
  await expect(selection).toHaveText('Other source')
  await saved(page)
  await selection.click()
  await page.getByRole('option', { name: 'Source book', exact: true }).click()
  await expect(selection).toHaveText('Source book')
  await saved(page)
  await page.getByRole('button', { name: 'Done', exact: true }).click()
}
