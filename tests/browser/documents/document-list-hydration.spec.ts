import type { Page } from '@playwright/test'
import { horizontalBounds } from '~/tests/support/browser/layout'
import { expect, test } from '~/tests/support/browser/test'
import { labels } from './document-list-boundary-helpers'

// The documents feature hydrates from a preloaded chunk. Deferring that chunk keeps
// the server markup live longer, which is the window a slow runner hit.
async function deferDocumentsChunk(page: Page): Promise<void> {
  await page.route(/\/_next\/static\/chunks\/document-list-.*\.js/, async (route) => {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 2000)
    })
    await route.continue()
  })
}

test('the search form stays disabled until hydration and opens before the list answers', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await deferDocumentsChunk(page)
  // Commit instead of load: the server markup stays observable before React takes over.
  await page.goto('/__fixture/login', { waitUntil: 'commit' })
  const copy = labels.en
  const search = page.getByRole('searchbox', { name: copy.search, exact: true })
  const submit = page.getByRole('button', { name: copy.submit, exact: true })
  // Server markup: typing here could never reach the controller.
  await expect(search).toBeDisabled()
  await expect(submit).toBeDisabled()
  await expect(page.getByRole('combobox', { name: 'Document type', exact: true })).toBeDisabled()
  await expect(page.getByRole('combobox', { name: copy.state, exact: true })).toBeDisabled()
  await page.screenshot({ path: info.outputPath('search-disabled-before-hydration-320.png') })
  // Hydration alone opens them; the first list request is not a prerequisite.
  await expect(search).toBeEnabled()
  await expect(submit).toBeEnabled()
  await expect(page.getByRole('combobox', { name: 'Document type', exact: true })).toBeEnabled()
  await expect(page.getByRole('combobox', { name: copy.state, exact: true })).toBeEnabled()
  const query = 'W'.repeat(120)
  await search.fill(query)
  await expect(search).toHaveValue(query)
  await submit.click()
  const chip = page.getByRole('list', { name: 'Active filters', exact: true }).getByRole('button')
  await expect(chip).toHaveAccessibleName(`Remove filter: ${copy.search}: ${query}`)
  await horizontalBounds(page, chip)
  // A list request in flight must never disable the form; only mutations do.
  let release = (): void => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route(/\/api\/admin\/documents(?:\?|$)/, async (route) => {
    await held
    await route.continue()
  })
  try {
    await page.getByRole('button', { name: copy.refresh, exact: true }).click()
    await expect(page.locator('.document-list-panel')).toHaveAttribute('aria-busy', 'true')
    await expect(search).toBeEnabled()
    await expect(submit).toBeEnabled()
  }
  finally {
    release()
  }
  await page.unroute(/\/api\/admin\/documents(?:\?|$)/)
  await expect(page.locator('.document-list-panel')).toHaveAttribute('aria-busy', 'false')
})
