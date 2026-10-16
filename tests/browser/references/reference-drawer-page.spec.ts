import process from 'node:process'
import { acknowledgementSchema, sessionSchema } from '@/content/contracts'
import { emptyDocument } from '@/content/document'
import { assertAccessible } from '~/tests/support/browser/accessibility'
import { writeDocument } from '~/tests/support/browser/document'
import { settingsTab } from '~/tests/support/browser/settings'
import { expect, test } from '~/tests/support/browser/test'
import { expectAuthors, replaceAuthors } from './reference-author-helpers'

for (const width of [320, 390]) {
  test(`reference pages share one drawer and restore settings at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 740 })
    await writeDocument(page, emptyDocument())
    await settingsTab(page, 'Content')
    const drawer = page.locator('.inspector-drawer')
    await drawer.getByRole('button', { name: /^References \(/ }).click()
    const add = drawer.getByRole('button', { name: 'Add reference', exact: true })
    await add.scrollIntoViewIfNeeded()
    const viewport = drawer.locator('.inspector-scroll .ztd-scroll-viewport')
    const position = await viewport.evaluate(element => element.scrollTop)
    await add.click()
    const editor = page.getByRole('dialog', { name: 'Add reference', exact: true })
    await expect(page.getByRole('dialog')).toHaveCount(1)
    await expect(page.locator('.reference-dialog')).toHaveCount(0)
    await expect(editor.getByLabel('DOI', { exact: true })).toBeFocused()
    await expect(editor.getByRole('button', { name: 'Save', exact: true })).toBeInViewport()
    await editor.getByRole('button', { name: 'Back to document settings', exact: true }).click()
    await expect(drawer).toHaveAccessibleName('Document settings')
    await expect(add).toBeFocused()
    await expect.poll(async () => await viewport.evaluate(element => element.scrollTop)).toBeCloseTo(position, 0)
    await add.click()
    await page.getByLabel('Reference title', { exact: true }).fill('Unsaved reference')
    await replaceAuthors(editor, ['Author one', 'Author two'])
    await editor.getByRole('button', { name: 'Back to document settings', exact: true }).click()
    await expect(editor.getByRole('alert')).toContainText('Discard reference changes?')
    await expect(editor.getByRole('button', { name: 'Keep editing', exact: true })).toBeFocused()
    await expect(page.getByRole('dialog')).toHaveCount(1)
    await assertAccessible(page, info, { label: `reference-discard-${width}` })
    await editor.getByRole('button', { name: 'Keep editing', exact: true }).click()
    await expect(editor.getByLabel('Reference title', { exact: true })).toHaveValue('Unsaved reference')
    await expect(editor.getByLabel('Reference title', { exact: true })).toBeFocused()
    await expectAuthors(editor, ['Author one', 'Author two'])
    await page.keyboard.press('Escape')
    await expect(editor.getByRole('alert')).toBeVisible()
    await editor.getByRole('button', { name: 'Discard changes', exact: true }).click()
    await expect(drawer).toHaveAccessibleName('Document settings')
    await expect(add).toBeFocused()
    await expect.poll(async () => await viewport.evaluate(element => element.scrollTop)).toBeCloseTo(position, 0)
    await add.click()
    await expect(editor.getByLabel('Reference title', { exact: true })).toHaveValue('')
    await expectAuthors(editor, [])
    await editor.getByRole('button', { name: 'Cancel', exact: true }).click()
    await drawer.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByLabel('Document body', { exact: true })).toBeVisible()
  })
}

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
