import { emptyDocument } from '@/content/document'
import { saved, writeDocument } from '~/tests/support/browser/document'
import { expect, test } from '~/tests/support/browser/test'

// Retained as E2E: the corrected publish is a real Worker write and the final
// assertion reads the public SSR page. The refusal list and the correction
// lifecycle are proved by the component cases; only this server/SSR fact keeps
// the case here.
test('correcting a rejected draft clears its reasons and publishes the saved content', async ({ page }) => {
  const document = emptyDocument()
  document.meta.slug = `publication-retry-${crypto.randomUUID()}`
  await writeDocument(page, document)
  const publish = page.getByRole('button', { name: 'Publish', exact: true })
  await publish.click()
  const notice = page.locator('.editor-notice[data-tone="error"]')
  await expect(notice.locator('[data-publication-description]')).toHaveText(['Add a document title.'])
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Corrected publication')
  await saved(page)
  await expect(notice).toHaveCount(0)
  const response = page.waitForResponse(result => result.url().endsWith('/publish')
    && result.request().method() === 'POST')
  await publish.click()
  expect((await response).status()).toBe(200)
  await expect(page.getByRole('link', { name: 'View live document', exact: true })).toBeVisible()
  const publicPage = await page.request.get(`/posts/${document.meta.slug}`)
  expect(publicPage.ok()).toBe(true)
  expect(await publicPage.text()).toContain('Corrected publication')
  await expect(notice).toHaveCount(0)
})
