import type { Page } from '@playwright/test'
import { openDocumentSchema } from '@/contracts/documents'
import { historySchema } from '@/contracts/history'
import { mutate } from '~/tests/support/browser/api'
import { horizontalBounds } from '~/tests/support/browser/layout'
import { expect, test } from '~/tests/support/browser/test'
import { historyFixture } from './history-helpers'

async function confirm(page: Page, action: 'restore' | 'publish'): Promise<void> {
  const name = action === 'restore' ? 'Restore as new draft' : 'Publish selected revision'
  await page.getByRole('button', { name, exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click()
}

for (const action of ['restore', 'publish'] as const) {
  test(`history keeps confirmed ${action} success when history refresh fails`, async ({ page }, info) => {
    const { path, first, latest } = await historyFixture(page)
    if (action === 'restore') {
      await page.getByRole('button', { name: /^Revision 2 / }).click()
    }
    const refreshPath = action === 'publish' ? path : `${path}/revisions`
    await page.route(`**${refreshPath}`, async route => await route.fulfill({
      status: 503,
      json: { code: 'UNAVAILABLE' },
    }))
    await confirm(page, action)
    const success = action === 'restore' ? 'Created a new draft revision' : 'Published the selected revision'
    await expect(page.getByRole('status').filter({ hasText: success })).toBeVisible()
    const alert = page.getByRole('alert')
    await expect(alert).toContainText('Refresh history before another operation.')
    await expect(page.getByRole('button', { name: 'Restore as new draft', exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Publish selected revision', exact: true })).toBeDisabled()
    await expect(page.getByRole('combobox', { name: 'Compare against', exact: true })).toBeDisabled()
    const current = openDocumentSchema.parse(await (await page.request.get(path)).json())
    expect(current.version).toBe(latest.version + 1)
    expect(current.liveRevisionId).toBe(action === 'publish' ? latest.headRevisionId : first.headRevisionId)
    if (action === 'restore') {
      expect(current.document.meta.title).toBe('First historical title')
      expect(current.headRevisionId).not.toBe(latest.headRevisionId)
    }
    await alert.scrollIntoViewIfNeeded()
    await page.screenshot({ path: info.outputPath(`history-${action}-refresh-failed.png`) })
    await page.unroute(`**${refreshPath}`)
    await page.getByRole('button', { name: 'Refresh history', exact: true }).click()
    await expect(alert).toHaveCount(0)
    await expect(page.getByRole('combobox', { name: 'Compare against', exact: true })).toBeEnabled()
    const refreshed = openDocumentSchema.parse(await (await page.request.get(path)).json())
    expect(refreshed.version).toBe(current.version)
  })
}

test('history reconciles an unknown restore result before allowing another mutation', async ({ page }) => {
  const { path, latest } = await historyFixture(page)
  await page.getByRole('button', { name: /^Revision 2 / }).click()
  let writes = 0
  await page.route(`**${path}/restore`, async (route) => {
    writes++
    const response = await route.fetch()
    expect(response.ok()).toBe(true)
    await route.abort('failed')
  })
  for (let attempt = 1; attempt <= 9; attempt++) {
    await confirm(page, 'restore')
    await expect(page.getByRole('alert')).toContainText('The operation result could not be confirmed.')
    await expect(page.getByRole('button', { name: 'Restore as new draft', exact: true })).toBeDisabled()
    await expect(page.getByRole('status').filter({ hasText: 'Created a new draft revision' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Refresh history', exact: true }).click()
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(page.getByRole('combobox', { name: 'Compare against', exact: true }))
      .toContainText(`Revision ${3 + attempt}`)
    const current = openDocumentSchema.parse(await (await page.request.get(path)).json())
    expect(current.version).toBe(latest.version + attempt)
    expect(current.document.meta.title).toBe('First historical title')
    const history = historySchema.parse(await (await page.request.get(`${path}/revisions`)).json())
    expect(history.items).toHaveLength(3 + attempt)
    expect(writes).toBe(attempt)
  }
})

test('history retries an uncommitted disconnected operation with the same idempotency key', async ({ page }) => {
  const { path, latest } = await historyFixture(page)
  await page.getByRole('button', { name: /^Revision 2 / }).click()
  const keys: string[] = []
  await page.route(`**${path}/restore`, async (route) => {
    keys.push(route.request().headers()['idempotency-key'] ?? '')
    if (keys.length === 1) {
      await route.abort('failed')
    }
    else {
      await route.continue()
    }
  })
  await confirm(page, 'restore')
  await expect(page.getByRole('alert')).toContainText('The operation result could not be confirmed.')
  await page.getByRole('button', { name: 'Refresh history', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  const unchanged = openDocumentSchema.parse(await (await page.request.get(path)).json())
  expect(unchanged.version).toBe(latest.version)
  await confirm(page, 'restore')
  await expect(page.getByRole('status').filter({ hasText: 'Created a new draft revision' })).toBeVisible()
  expect(keys).toHaveLength(2)
  expect(keys[0]).not.toBe('')
  expect(keys[1]).toBe(keys[0])
  const current = openDocumentSchema.parse(await (await page.request.get(path)).json())
  expect(current.version).toBe(latest.version + 1)
})

test('history explains a definite maintenance rejection without calling it an unknown result', async ({ page }) => {
  const { path } = await historyFixture(page)
  await page.route(`**${path}/publish`, async route => await route.fulfill({
    status: 503,
    json: { code: 'MAINTENANCE' },
  }))
  await confirm(page, 'publish')
  const alert = page.getByRole('alert')
  await expect(alert).toContainText('Writes are paused for maintenance.')
  await expect(alert).not.toContainText('could not be confirmed')
  await expect(page.getByRole('button', { name: 'Publish selected revision', exact: true })).toBeEnabled()
})

test('history keeps a conflict readable when loading the new baseline fails', async ({ page }) => {
  const { path, latest } = await historyFixture(page)
  await page.getByRole('button', { name: /^Revision 2 / }).click()
  const external = openDocumentSchema.parse(await (await page.request.get(path)).json())
  external.document.meta.title = 'External conflict during history refresh'
  await mutate(page, `${path}/revisions`, {
    expectedVersion: latest.version,
    baseRevisionId: latest.headRevisionId,
    reason: 'manual',
    document: external.document,
  }, 'PUT')
  await page.route(`**${path}`, async route => await route.fulfill({ status: 503, json: { code: 'UNAVAILABLE' } }))
  await confirm(page, 'restore')
  await expect(page.getByRole('status').filter({ hasText: 'Another tab changed this document' })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('Refresh history before another operation.')
  await expect(page.getByRole('button', { name: 'Restore as new draft', exact: true })).toBeDisabled()
  await page.unroute(`**${path}`)
  await page.getByRole('button', { name: 'Refresh history', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: 'Compare against', exact: true })).toContainText('Revision 4')
  await expect(page.getByRole('button', { name: 'Restore as new draft', exact: true })).toBeEnabled()
})

test('a new failed history operation clears the previous success notice', async ({ page }) => {
  const { path } = await historyFixture(page)
  await page.getByRole('button', { name: /^Revision 2 / }).click()
  await confirm(page, 'restore')
  const success = page.getByRole('status').filter({ hasText: 'Created a new draft revision' })
  await expect(success).toBeVisible()
  await page.route(`**${path}/restore`, async route => await route.fulfill({
    status: 403,
    json: { code: 'OWNER_REQUIRED' },
  }))
  await confirm(page, 'restore')
  await expect(page.getByRole('alert')).toContainText('Sign in as the owner')
  await expect(success).toHaveCount(0)
})

test('history displays actionable reasons returned by the publication API', async ({ page }) => {
  const { path } = await historyFixture(page)
  await page.route(`**${path}/publish`, async route => await route.fulfill({
    status: 422,
    json: { code: 'PUBLICATION_INVALID', issues: ['image', 'table'] },
  }))
  await confirm(page, 'publish')
  const alert = page.getByRole('alert')
  await expect(alert.getByRole('listitem')).toHaveText([
    'Add image alternative text or mark the image as decorative.',
    'Add a caption to each table.',
  ])
  await expect(alert).not.toContainText('PUBLICATION_INVALID')
})

for (const locale of ['en', 'zh'] as const) {
  test(`history explains unpublished revision requirements in ${locale}`, async ({ page }, info) => {
    await page.setViewportSize({ width: locale === 'zh' ? 390 : 1440, height: 1000 })
    await historyFixture(page)
    if (locale === 'zh') {
      await page.getByRole('combobox', { name: 'Language', exact: true }).click()
      await page.getByRole('option', { name: '简体中文', exact: true }).click()
      await page.reload()
      await page.getByRole('combobox', { name: '所选修订', exact: true }).click()
      await page.getByRole('option', { name: '修订 1', exact: true }).click()
    }
    else {
      await page.getByRole('button', { name: /^Revision 1 / }).click()
    }
    const reasons = page.locator('.history-publication-requirements')
    await expect(reasons.getByRole('listitem')).toHaveText(locale === 'zh'
      ? ['请填写文档标题。', '请填写有效且非保留的 Slug。']
      : ['Add a document title.', 'Use a valid, unreserved slug.'])
    await expect(page.getByRole('button', {
      name: locale === 'zh' ? '发布所选修订' : 'Publish selected revision',
      exact: true,
    })).toBeDisabled()
    await expect(page.getByRole('button', {
      name: locale === 'zh' ? '恢复为新草稿' : 'Restore as new draft',
      exact: true,
    })).toBeEnabled()
    await reasons.scrollIntoViewIfNeeded()
    await horizontalBounds(page, reasons)
    await page.screenshot({ path: info.outputPath(`history-requirements-${locale}.png`) })
    if (locale === 'zh') {
      await page.getByRole('combobox', { name: '所选修订', exact: true }).click()
      await page.getByRole('option', { name: /^修订 3 / }).click()
    }
    else {
      await page.getByRole('button', { name: /^Revision 3 / }).click()
    }
    await expect(reasons).toHaveCount(0)
  })
}
