import { historyEditor } from '~/tests/browser/history/editor-history-helpers'
import { assertAccessible } from '~/tests/support/browser/accessibility'
import { expect, test } from '~/tests/support/browser/test'

for (const failure of [
  'connection',
  'deleted',
  'owner',
  'server',
] as const) {
  test(`cached editor history blocks stale editing after a ${failure} failure`, async ({ page }, info) => {
    const original = await historyEditor(page, 'back')
    await page.getByRole('link', { name: 'Tags', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Tags', exact: true })).toBeVisible()
    if (failure === 'connection') {
      await page.setViewportSize({ width: 320, height: 900 })
    }
    const pattern = failure === 'owner' ? '**/api/admin/session' : `**/api/admin/documents/${original.documentId}`
    const codes = { deleted: 'DOCUMENT_NOT_FOUND', connection: 'CONNECTION_FAILED', server: 'INTERNAL_ERROR' }
    let documentReads = 0
    page.on('request', (request) => {
      if (request.url().endsWith(`/api/admin/documents/${original.documentId}`)) {
        documentReads++
      }
    })
    await page.route(pattern, async route => await route.fulfill({
      status: { owner: 200, deleted: 404, connection: 503, server: 500 }[failure],
      json: failure === 'owner'
        ? { ownerSub: 'another-owner', csrfToken: 'another-token' }
        : { code: codes[failure] },
    }))
    await page.goBack()
    await expect(page.getByRole('heading', { name: 'Unable to open this document.', exact: true })).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveCount(0)
    const alert = page.getByRole('alert')
    await expect(alert).toContainText({
      connection: 'Unable to load data. Please retry.',
      deleted: 'This document is unavailable or has been removed.',
      owner: 'Your session expired. Refresh the page and retry.',
      server: 'Unable to load data. Please retry.',
    }[failure])
    if (failure === 'owner') {
      expect(documentReads).toBe(0)
    }
    if (failure === 'connection') {
      await assertAccessible(page, info, { label: 'editor-entry-unavailable-320' })
    }
    await page.unroute(pattern)
    await page.getByRole('button', { name: 'Retry', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(original.title)
    expect(await page.evaluate(() => history.length)).toBe(original.length + 1)
  })
}

test('leaving while refreshing an editor prevents a late load from replacing the destination', async ({ page }) => {
  const original = await historyEditor(page, 'back')
  await page.getByRole('link', { name: 'Tags', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Tags', exact: true })).toBeVisible()
  let release = (): void => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  let started = (): void => {}
  const loading = new Promise<void>((resolve) => {
    started = resolve
  })
  await page.route(`**/api/admin/documents/${original.documentId}`, async (route) => {
    const response = await route.fetch()
    started()
    await held
    await route.fulfill({ response })
  }, { times: 1 })
  await page.goBack()
  await loading
  await page.getByRole('link', { name: 'Series', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Series', exact: true })).toBeVisible()
  release()
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveURL(/\/admin\/series$/)
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveCount(0)
})
