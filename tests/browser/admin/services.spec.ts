import type { Page } from '@playwright/test'
import { openDocumentSchema } from '@/contracts/documents'
import { scheduleListSchema } from '@/contracts/publication'
import { sessionSchema } from '@/contracts/session'
import { chooseTimezone, publicationTime, verifiedTime } from '~/tests/browser/publication/schedule-helpers'
import { saved } from '~/tests/support/browser/document'
import { settingsTab } from '~/tests/support/browser/settings'
import { expect, test } from '~/tests/support/browser/test'

async function fresh(page: Page): Promise<void> {
  await page.goto('/__fixture/login')
  await page.getByRole('button', { name: 'New post' }).click()
  await page.getByLabel('Title', { exact: true }).fill('Operations browser fixture')
  await page.getByLabel('Slug', { exact: true }).fill(`operations-${crypto.randomUUID()}`)
  await page.getByLabel('Document body', { exact: true }).fill('Native catalog and schedule')
  await saved(page)
}
async function opened(page: Page): Promise<ReturnType<typeof openDocumentSchema.parse>> {
  return openDocumentSchema.parse(
    await (
      await page.request.get(
        new URL(page.url()).pathname.replace('/admin/documents/', '/api/admin/documents/'),
      )
    ).json(),
  )
}
test('catalog snapshots and schedule pinning are usable from the editor', async ({
  page,
}) => {
  await fresh(page)
  await page.getByText('Tags and series', { exact: true }).click()
  const tags = page.getByRole('region', { name: 'Tags and series', exact: true })
  const session = sessionSchema.parse(await (await page.request.get('/api/admin/session')).json())
  const tagName = `Browser tag ${crypto.randomUUID()}`
  const created = await page.request.post('/api/admin/catalog/tag', {
    data: { slug: `browser-tag-${crypto.randomUUID()}`, name: tagName },
    headers: {
      'origin': new URL(page.url()).origin,
      'x-csrf-token': session.csrfToken,
      'idempotency-key': crypto.randomUUID(),
    },
  })
  expect(created.ok()).toBe(true)
  await tags.getByRole('combobox', { name: 'Tags', exact: true }).click()
  await page.getByRole('combobox', { name: 'Search tags', exact: true }).fill(tagName)
  await page.getByRole('option', { name: tagName, exact: true }).click()
  await page.keyboard.press('Escape')
  await saved(page)
  expect((await opened(page)).document.meta.tags[0]?.label).toBe(tagName)
  await settingsTab(page, 'Publication')
  await page.getByText('Scheduled publication', { exact: true }).click()
  const time = new Date(Date.now() + 3600000).toISOString().slice(0, 16)
  await publicationTime(page, time)
  await chooseTimezone(page, 'UTC')
  await page.getByRole('button', { name: 'Check timezone and DST' }).click()
  await verifiedTime(page)
  const pin = (await opened(page)).headRevisionId
  await page.getByRole('button', { name: 'Schedule saved draft' }).click()
  await expect(page.getByRole('button', { name: 'Cancel schedule' })).toBeVisible()
  await page.getByLabel('Document body', { exact: true }).fill('A newer draft stays separate')
  await saved(page)
  const jobs = scheduleListSchema.parse(
    await (
      await page.request.get(
        `/api/admin/documents/${(await opened(page)).documentId}/schedule`,
      )
    ).json(),
  )
  expect(jobs.items[0]?.revisionId).toBe(pin)
  await page.getByRole('button', { name: 'Cancel schedule' }).click()
  await expect(page.getByRole('button', { name: 'Cancel schedule' })).toHaveCount(0)
  await page.goto('/admin/operations')
  await expect(page.getByRole('heading', { name: 'Operations', exact: true })).toBeVisible()
  await expect(page.getByText('Database capacity', { exact: true })).toBeVisible()
})
test('bounded HTML paste preserves supported formatting and removes active content', async ({
  page,
}) => {
  await fresh(page)
  const body = page.getByLabel('Document body', { exact: true })
  await body.click()
  await body.evaluate((element) => {
    const data = new DataTransfer()
    data.setData(
      'text/html',
      '<h2>Clipboard heading</h2><p><strong>Bold clip</strong>'
      + '<a href="javascript:alert(1)">Unsafe link</a><script>alert(1)</script></p>',
    )
    data.setData('text/plain', 'Clipboard heading Bold clip Unsafe link')
    element.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
    )
  })
  await expect(body).toContainText('Clipboard heading')
  await expect(body.locator('strong')).toContainText('Bold clip')
  await expect(body.locator('a[href^="javascript:"]')).toHaveCount(0)
  await expect(body.locator('script')).toHaveCount(0)
  await saved(page)
  const doc = (await opened(page)).document
  expect(doc.blocks.some(block => block.type === 'heading')).toBe(true)
  expect(new Set(doc.blocks.map(block => block.id)).size).toBe(doc.blocks.length)
})

test('scheduling locks publication and keeps the native editor mounted while the request is pending', async ({
  page,
}) => {
  await fresh(page)
  const body = page.getByLabel('Document body', { exact: true })
  const editor = await body.elementHandle()
  await settingsTab(page, 'Publication')
  await page.getByText('Scheduled publication', { exact: true }).click()
  await publicationTime(page, new Date(Date.now() + 3600000).toISOString().slice(0, 16))
  await chooseTimezone(page, 'UTC')
  await page.getByRole('button', { name: 'Check timezone and DST', exact: true }).click()
  await verifiedTime(page)
  let started: (() => void) | undefined
  const requested = new Promise<void>((resolve) => {
    started = resolve
  })
  let finish: (() => void) | undefined
  const pending = new Promise<void>((resolve) => {
    finish = resolve
  })
  await page.route('**/api/admin/documents/*/schedule', async (route) => {
    if (route.request().method() === 'POST') {
      started?.()
      await pending
    }
    await route.continue()
  })
  await page.getByRole('button', { name: 'Schedule saved draft', exact: true }).click()
  await requested
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled()
  await expect(body).toHaveAttribute('contenteditable', 'false')
  finish?.()
  await expect(page.getByRole('button', { name: 'Cancel schedule', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeEnabled()
  await expect(body).toHaveAttribute('contenteditable', 'true')
  expect(await editor.evaluate(element => element.isConnected)).toBe(true)
  await saved(page)
})
