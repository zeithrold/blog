import { expect, test } from '~/tests/support/browser/test'
import { fixture } from './catalog-boundary-helpers'

test('catalog retries an unknown creation after refreshing with the original idempotency key', async ({ page }) => {
  const { path } = await fixture(page, 'tag')
  const name = `Unknown creation ${crypto.randomUUID()}`
  await page.getByLabel('Name', { exact: true }).fill(name)
  await page.getByLabel('Slug', { exact: true }).fill(`unknown-${crypto.randomUUID()}`)
  const keys: string[] = []
  await page.route(`**${path}`, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue()
      return
    }
    keys.push(route.request().headers()['idempotency-key'] ?? '')
    if (keys.length === 1) {
      await route.fetch()
      await route.abort('failed')
    }
    else {
      await route.continue()
    }
  })
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Connection failed')
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.getByRole('button', { name: `Edit ${name}`, exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Catalog entry created.' })).toBeVisible()
  expect(keys).toHaveLength(2)
  expect(keys[0]).not.toBe('')
  expect(keys[1]).toBe(keys[0])
  await expect(page.getByRole('button', { name: `Edit ${name}`, exact: true })).toHaveCount(1)
})
