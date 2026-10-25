import { acknowledgementSchema } from '@/contracts/documents'
import { holdRequest } from '~/tests/support/browser/held-request'
import { expect, test } from '~/tests/support/browser/test'

test('a late creation response preserves navigation away from the document list', async ({ page }) => {
  await page.goto('/__fixture/login')
  const hold = await holdRequest(page, '/api/admin/documents', 'POST')
  try {
    await page.getByRole('button', { name: 'New post', exact: true }).click()
    await hold.captured
    const captured = hold.answers()[0]
    if (captured === undefined) {
      throw new Error('The creation acknowledgement was not captured')
    }
    const documentId = acknowledgementSchema.parse(JSON.parse(captured.body.toString('utf8'))).documentId
    await page.getByRole('link', { name: 'Media library', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Gallery', exact: true })).toBeVisible()
    const completed = page.waitForResponse(response => response.url().endsWith('/api/admin/documents')
      && response.request().method() === 'POST')
    await hold.release()
    expect((await completed).ok()).toBe(true)
    // The held acknowledgement has reached the browser; the destination has to stay
    // put. The gallery publishes its own settled state only after its session request
    // answers, so a late navigation would replace the surface these assertions read.
    await expect(page).toHaveURL(/\/admin\/media$/)
    await expect(page.getByRole('heading', { name: 'Gallery', exact: true })).toBeVisible()
    await expect(page.getByText('No media yet', { exact: true })).toBeVisible()
    expect((await page.request.get(`/api/admin/documents/${documentId}`)).ok()).toBe(true)
  }
  finally {
    await hold.dispose()
  }
})
