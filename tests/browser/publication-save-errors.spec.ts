import { expect, test } from '@playwright/test'
import { emptyDocument } from '../../src/content/document'
import { writeDocument } from './helpers'

for (const failure of [
  { status: 413, code: 'DOCUMENT_TOO_LARGE', message: 'The document exceeds the size limit.' },
  { status: 422, code: 'INVALID_DOCUMENT', message: 'The document failed validation.' },
  { status: 0, code: 'CONNECTION_FAILED', message: 'Connection failed.' },
]) {
  test(`publishing retains the save failure reason ${failure.code} and permits correction`, async ({ page }) => {
    const document = emptyDocument()
    document.meta.title = 'Save failure'
    document.meta.slug = `save-failure-${crypto.randomUUID()}`
    await writeDocument(page, document)
    let publishes = 0
    page.on('request', (request) => {
      if (request.url().endsWith('/publish') && request.method() === 'POST') {
        publishes++
      }
    })
    await page.route('**/revisions', async (route) => {
      if (route.request().method() !== 'PUT') {
        await route.continue()
      }
      else if (failure.status === 0) {
        await route.abort('internetdisconnected')
      }
      else {
        await route.fulfill({ status: failure.status, json: { code: failure.code } })
      }
    })
    await page.getByLabel('Title', { exact: true }).fill('Changed draft')
    const publish = page.getByRole('button', { name: 'Publish', exact: true })
    await publish.click()
    const notice = page.locator('.editor-notice[data-tone="error"]')
    await expect(notice).toContainText(failure.message)
    await publish.click()
    await expect(notice).toContainText(failure.message)
    await expect(notice).not.toContainText('Wait for the draft')
    expect(publishes).toBe(0)
    await page.unroute('**/revisions')
    await page.getByLabel('Title', { exact: true }).fill('Corrected draft')
    await publish.click()
    await expect(page.getByRole('link', { name: 'View live document', exact: true })).toBeVisible()
    await expect(notice).toHaveCount(0)
    expect(publishes).toBe(1)
  })
}
