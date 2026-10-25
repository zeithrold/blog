import type { Page } from '@playwright/test'
import { holdRequest } from '~/tests/support/browser/held-request'
import { expect, test } from '~/tests/support/browser/test'
import { fixture } from './catalog-boundary-helpers'

// A catalog navigation only becomes part of the browser's history once its route has
// committed. Clicking away before the gallery is there leaves the previous entry current,
// so the return trip lands wherever the session started instead of on the gallery.
async function openGallery(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'Media library', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Gallery', exact: true })).toBeVisible()
}

test('switching a clean catalog form to the other catalog starts an empty form', async ({ page }) => {
  const { first } = await fixture(page, 'tag')
  await page.getByRole('button', { name: `Edit ${first.name}`, exact: true }).click()
  await page.getByRole('link', { name: 'Series', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Series', exact: true })).toBeVisible()
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('')
  await expect(page.getByLabel('Slug', { exact: true })).toHaveValue('')
  await expect(page.getByLabel('Retired', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
})

for (const width of [1440, 320]) {
  test(`catalog navigation asks before discarding at ${width}px`, async ({ page }, info) => {
    test.setTimeout(15000)
    await page.setViewportSize({ width, height: 900 })
    const { first } = await fixture(page, 'tag')
    await page.getByRole('button', { name: `Edit ${first.name}`, exact: true }).click()
    await page.getByLabel('Name', { exact: true }).fill('Local protected name')
    const openNavigation = async (): Promise<void> => {
      if (width === 320) {
        await page.getByRole('button', { name: 'Tags', exact: true }).click()
        await page.getByRole('menuitem', { name: 'Series', exact: true }).click()
      }
      else {
        await page.getByRole('link', { name: 'Series', exact: true }).click()
      }
      await expect(page.getByRole('dialog', { name: 'Leave the catalog editor?', exact: true })).toBeVisible()
    }
    await openNavigation()
    const dialog = page.getByRole('dialog', { name: 'Leave the catalog editor?', exact: true })
    await expect(dialog).toBeVisible()
    await expect(page.getByRole('menu')).toHaveCount(0)
    await expect(page).toHaveURL(/\/admin\/tags$/)
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Local protected name')
    await expect(dialog).toHaveCount(0)
    if (width === 320) {
      await expect(page.getByRole('button', { name: 'Tags', exact: true })).toBeFocused()
    }
    await openNavigation()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    if (width === 320) {
      await expect(page.getByRole('button', { name: 'Tags', exact: true })).toBeFocused()
    }
    await openNavigation()
    await page.screenshot({ path: info.outputPath(`catalog-leave-${width}.png`) })
    await dialog.getByRole('button', { name: 'Confirm', exact: true }).click()
    await expect(page).toHaveURL(/\/admin\/series$/)
    await expect(page.getByRole('heading', { name: 'Series', exact: true })).toBeVisible()
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('')
  })
}

test('catalog navigation waits for an in-flight save before leaving', async ({ page }) => {
  const { first, path } = await fixture(page, 'tag')
  await page.getByRole('button', { name: `Edit ${first.name}`, exact: true }).click()
  await page.getByLabel('Name', { exact: true }).fill('Confirmed before leaving')
  const hold = await holdRequest(page, `${path}/${first.id}`, 'PUT')
  try {
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await hold.captured
    await page.getByRole('link', { name: 'Series', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Leave the catalog editor?', exact: true })
    await expect(dialog).toContainText('Wait for the current save to finish')
    await expect(dialog.getByRole('button', { name: 'Saving…', exact: true })).toBeDisabled()
    await hold.release()
    await dialog.getByRole('button', { name: 'Confirm', exact: true }).click()
    await expect(page).toHaveURL(/\/admin\/series$/)
  }
  finally {
    await hold.dispose()
  }
})

for (const direction of ['back', 'forward'] as const) {
  test(`catalog draft survives browser ${direction} and returning without changing history`, async ({ page }) => {
    const { first } = await fixture(page, 'tag')
    await openGallery(page)
    if (direction === 'back') {
      await page.getByRole('link', { name: 'Tags', exact: true }).click()
    }
    else {
      await page.goBack()
    }
    await page.getByRole('button', { name: `Edit ${first.name}`, exact: true }).click()
    await page.getByLabel('Name', { exact: true }).fill('Protected browser history draft')
    const length = await page.evaluate(() => history.length)
    for (let attempt = 0; attempt < 2; attempt++) {
      await (direction === 'back' ? page.goBack() : page.goForward())
      await expect(page.getByRole('heading', { name: 'Gallery', exact: true })).toBeVisible()
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await (direction === 'back' ? page.goForward() : page.goBack())
      await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Protected browser history draft')
      await expect(page.getByLabel('Slug', { exact: true })).toHaveValue(first.slug)
      await expect(page.getByLabel('Retired', { exact: true })).not.toBeChecked()
      await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled()
      expect(await page.evaluate(() => history.length)).toBe(length)
    }
  })
}

test('an unknown catalog creation retries its original request after browser history navigation', async ({ page }) => {
  const { path } = await fixture(page, 'tag')
  await openGallery(page)
  await page.getByRole('link', { name: 'Tags', exact: true }).click()
  const name = `History retry ${crypto.randomUUID()}`
  await page.getByLabel('Name', { exact: true }).fill(name)
  await page.getByLabel('Slug', { exact: true }).fill(`history-retry-${crypto.randomUUID()}`)
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
  await page.goBack()
  await expect(page.getByRole('heading', { name: 'Gallery', exact: true })).toBeVisible()
  await page.goForward()
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue(name)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Catalog entry created.' })).toBeVisible()
  expect(keys).toHaveLength(2)
  expect(keys[0]).not.toBe('')
  expect(keys[1]).toBe(keys[0])
  await expect(page.getByRole('button', { name: `Edit ${name}`, exact: true })).toHaveCount(1)
})

test('a catalog save stays busy through browser navigation and only updates its original form', async ({ page }) => {
  const { first, path } = await fixture(page, 'tag')
  const name = `Saved across navigation ${crypto.randomUUID()}`
  await openGallery(page)
  await page.getByRole('link', { name: 'Tags', exact: true }).click()
  await page.getByRole('button', { name: `Edit ${first.name}`, exact: true }).click()
  await page.getByLabel('Name', { exact: true }).fill(name)
  const hold = await holdRequest(page, `${path}/${first.id}`, 'PUT')
  try {
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await hold.captured
    await page.goBack()
    await expect(page.getByRole('heading', { name: 'Gallery', exact: true })).toBeVisible()
    await page.goForward()
    await expect(page.getByLabel('Name', { exact: true })).toBeDisabled()
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue(name)
    await expect(page.getByRole('button', { name: 'Saving…', exact: true })).toBeDisabled()
    await hold.release()
    await expect(page.getByRole('status').filter({ hasText: 'Catalog entry saved.' })).toBeVisible()
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('')
    await expect(page.getByRole('button', { name: `Edit ${name}`, exact: true })).toBeVisible()
    expect(hold.observed()).toBe(1)
  }
  finally {
    await hold.dispose()
  }
})

test('tags and series keep independent drafts while traversing the same browser history', async ({ page }) => {
  await fixture(page, 'tag')
  await page.getByRole('link', { name: 'Series', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Series', exact: true })).toBeVisible()
  await page.getByLabel('Name', { exact: true }).fill('Series-only draft')
  await page.getByLabel('Slug', { exact: true }).fill(`series-draft-${crypto.randomUUID()}`)
  await page.goBack()
  await expect(page.getByRole('heading', { name: 'Tags', exact: true })).toBeVisible()
  await page.getByLabel('Name', { exact: true }).fill('Tag-only draft')
  await page.getByLabel('Slug', { exact: true }).fill(`tag-draft-${crypto.randomUUID()}`)
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.goForward()
    await expect(page.getByRole('heading', { name: 'Series', exact: true })).toBeVisible()
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Series-only draft')
    await page.goBack()
    await expect(page.getByRole('heading', { name: 'Tags', exact: true })).toBeVisible()
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Tag-only draft')
  }
})
