import type { Page } from '@playwright/test'
import { emptyDocument } from '@/content/document'
import { saved, writeDocument } from '~/tests/support/browser/document'
import { expect, test } from '~/tests/support/browser/test'

async function unpublish(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'More document actions', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Unpublish', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click()
}

for (const action of ['publish', 'unpublish']) {
  test(`a clean tab resolves a ${action} conflict before retrying`, async ({ page, context }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const document = emptyDocument()
    document.meta.title = 'Publication conflict'
    document.meta.slug = `publication-conflict-${crypto.randomUUID()}`
    await writeDocument(page, document)
    if (action === 'unpublish') {
      await page.getByRole('button', { name: 'Publish', exact: true }).click()
      await expect(page.getByRole('link', { name: 'View live document', exact: true })).toBeVisible()
    }
    const second = await context.newPage()
    await second.goto(page.url())
    await expect(second.getByLabel('Document body', { exact: true })).toBeVisible()
    await page.getByLabel('Title', { exact: true }).fill('Latest saved title')
    await saved(page)
    const rejected = second.waitForResponse(response => response.url().endsWith(`/${action}`)
      && response.request().method() === 'POST')
    if (action === 'publish') {
      await second.getByRole('button', { name: 'Publish', exact: true }).click()
    }
    else {
      await unpublish(second)
    }
    expect((await rejected).status()).toBe(409)
    const conflict = second.getByRole('region', { name: 'Draft conflict', exact: true })
    await expect(conflict).toBeVisible()
    await expect(second.locator('.editor-publish-action')).toBeDisabled()
    await conflict.getByRole('button', { name: 'Compare changes', exact: true }).click()
    await expect(conflict.getByRole('region', { name: 'Conflict comparison', exact: true })).toBeVisible()
    await conflict.getByRole('button', { name: 'Use server version', exact: true }).click()
    await expect(second.getByLabel('Title', { exact: true })).toHaveValue('Latest saved title')
    await expect(conflict).toHaveCount(0)
    const accepted = second.waitForResponse(response => response.url().endsWith(`/${action}`)
      && response.request().method() === 'POST')
    if (action === 'publish') {
      await second.getByRole('button', { name: 'Publish', exact: true }).click()
    }
    else {
      await unpublish(second)
    }
    expect((await accepted).status()).toBe(200)
    await second.close()
  })
}
