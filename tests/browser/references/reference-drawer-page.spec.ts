import process from 'node:process'
import { acknowledgementSchema } from '@/contracts/documents'
import { sessionSchema } from '@/contracts/session'
import { settingsTab } from '~/tests/support/browser/settings'
import { expect, test } from '~/tests/support/browser/test'
import { expectAuthors, replaceAuthors } from './reference-author-helpers'

test('touch dragging sorts authors without dismissing the drawer', async ({ browser, browserName }) => {
  test.skip(browserName !== 'chromium', 'Physical touch dragging uses Chromium CDP.')
  const context = await browser.newContext({ viewport: { width: 390, height: 900 }, hasTouch: true, isMobile: true })
  const page = await context.newPage()
  // New contexts do not inherit the configured test base URL.
  await page.goto(`http://127.0.0.1:${process.env.BLOG_TEST_PORT ?? '8801'}/__fixture/login`)
  const origin = new URL(page.url()).origin
  const session = sessionSchema.parse(await (await page.request.get(`${origin}/api/admin/session`)).json())
  const response = await page.request.post(`${origin}/api/admin/documents`, {
    headers: { origin, 'x-csrf-token': session.csrfToken, 'idempotency-key': crypto.randomUUID() },
    data: {},
  })
  const created = acknowledgementSchema.parse(await response.json())
  await page.goto(`${origin}/admin/documents/${created.documentId}`)
  await expect(page.getByLabel('Document body', { exact: true })).toBeVisible()
  await settingsTab(page, 'Content')
  await page.getByRole('button', { name: /^References \(/ }).click()
  await page.getByRole('button', { name: 'Add reference', exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Add reference', exact: true })
  await replaceAuthors(editor, [
    'First',
    'Second',
    'Third',
  ])
  const handle = editor.getByRole('button', { name: 'Reorder author 1', exact: true })
  await handle.scrollIntoViewIfNeeded()
  const source = await handle.boundingBox()
  const target = await editor.locator('[data-author-row]').nth(2).boundingBox()
  if (source === null || target === null) {
    throw new Error('Missing touch bounds')
  }
  const cdp = await context.newCDPSession(page)
  const x = source.x + source.width / 2
  const y = source.y + source.height / 2
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [
    { x, y },
  ] })
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      { x, y: target.y + target.height / 2 },
    ],
  })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await expectAuthors(editor, [
    'Second',
    'Third',
    'First',
  ])
  await expect(page.getByRole('dialog')).toHaveCount(1)
  await context.close()
})
