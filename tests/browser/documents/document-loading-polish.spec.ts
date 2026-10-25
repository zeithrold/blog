import type { Page } from '@playwright/test'
import { documentListReady } from '~/tests/support/browser/document'
import { expect, test } from '~/tests/support/browser/test'

// Nothing here decides which page errors count: every uncaught error fails the test.
function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  return errors
}

// The surface keeps every uncaught error, including the wording a cancelled prefetch
// produces. A filter that excused that text by itself would pass this test only if the
// listener stopped reporting it, which is exactly what this asserts against.
test('a cancelled-prefetch message stays a failure on the loading surface', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/__fixture/login')
  await documentListReady(page)
  const forged = '/127.0.0.1:9/admin/documents?_rsc=forged due to access control checks.'
  const raised = page.waitForEvent('pageerror')
  await page.evaluate((message) => {
    setTimeout(() => {
      throw new Error(message)
    })
  }, forged)
  expect((await raised).message).toBe(forged)
  expect(errors).toEqual([forged])
})
