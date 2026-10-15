import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { captureState } from '@ztd-me/frontend-checks/playwright'
import { openDocumentSchema } from '../../src/content/contracts'
import { assertAccessible } from './accessibility'
import { saved, settingsTab } from './helpers'

async function draftAndSavedPreview(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Preview', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Draft preview', exact: true })
  await expect(dialog.getByRole('heading', { name: 'Browser verified post', exact: true })).toBeVisible()
  await expect(dialog.getByRole('region', { name: 'Draft reader preview', exact: true }))
    .toContainText('Native English content')
  await dialog.getByRole('button', { name: 'Close preview', exact: true }).click()
  const documentId = new URL(page.url()).pathname.split('/').at(-1)
  if (documentId === undefined) {
    throw new Error('Missing editor document ID')
  }
  const open = openDocumentSchema.parse(await (await page.request.get(`/api/admin/documents/${documentId}`)).json())
  return `/admin/preview/${open.documentId}/${open.headRevisionId}`
}

test('publication summary explains saving before publishing and warns before changing a live URL', async ({
  page,
  context,
}) => {
  const before = `publication-before-${crypto.randomUUID()}`
  const after = `publication-after-${crypto.randomUUID()}`
  await page.goto('/__fixture/login')
  await page.getByRole('button', { name: 'New post' }).click()
  await settingsTab(page, 'Publication')
  await expect(page.getByText('Add a document title.', { exact: true })).toBeVisible()
  await settingsTab(page, 'Content')
  await page.getByLabel('Title', { exact: true }).fill('Publication readiness')
  await page.getByLabel('Slug', { exact: true }).fill(before)
  await page.getByLabel('Document body', { exact: true }).fill('A draft with a deliberate public URL')
  await saved(page)
  await expect(page.getByText('Add a document title.', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  const liveLink = page.getByRole('link', { name: 'View live document', exact: true })
  await expect(liveLink).toHaveAttribute('href', `/posts/${before}`)
  await page.getByLabel('Slug', { exact: true }).fill(after)
  await expect(page.getByText('Published · unpublished changes', { exact: true })).toBeVisible()
  await expect(page.getByText(
    `After publishing, the old URL /posts/${before} will stop working. No redirect is created.`,
    { exact: true },
  )).toBeVisible()
  await settingsTab(page, 'Publication')
  await expect(page.getByText(
    'Publishing saves your current draft before making it public.',
    { exact: true },
  )).toBeVisible()
  await saved(page)
  expect((await context.request.get(`/posts/${before}`)).status()).toBe(200)
  expect((await context.request.get(`/posts/${after}`)).status()).toBe(404)
  await page.getByRole('button', { name: 'Update publication', exact: true }).click()
  await expect(liveLink).toHaveAttribute('href', `/posts/${after}`)
  expect((await context.request.get(`/posts/${before}`)).status()).toBe(404)
  expect((await context.request.get(`/posts/${after}`)).status()).toBe(200)
  await settingsTab(page, 'Publication')
  await page.getByRole('button', { name: 'Revision history', exact: true }).click()
  const current = page.locator('.revision-list li').filter({ hasText: 'Current draft' })
  await expect(current.getByText('Live', { exact: true })).toBeVisible()
  await expect(current.locator('time')).toBeVisible()
  await expect(current.getByRole('button', { name: 'Restore', exact: true })).toBeDisabled()
  await expect(page.getByRole('link', { name: 'View and compare revisions', exact: true }))
    .toHaveAttribute('href', /\/admin\/documents\/[^/]+\/history$/)
})

test('native editing, autosave, preview and publish keep public content isolated', async ({
  page,
  context,
}, info) => {
  const path = `/posts/browser-verified-${crypto.randomUUID()}`
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text())
    }
  })
  await page.goto('/__fixture/login')
  await expect(page.getByRole('heading', { name: 'Documents', exact: true })).toBeVisible()
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'New post' }).click()
  await expect(page.locator('.bn-editor[contenteditable="true"]')).toBeVisible()
  const editor = page.locator('.bn-editor[contenteditable="true"]')
  await page.getByLabel('Title', { exact: true }).fill('Browser verified post')
  await page.getByLabel('Slug', { exact: true }).fill(path.slice('/posts/'.length))
  await editor.fill('Native English content 中文搜索')
  await expect(page.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible({
    timeout: 15000,
  })
  const unpublished = await context.request.get(path)
  expect(unpublished.status()).toBe(404)
  const previewURL = await draftAndSavedPreview(page)
  const preview = await context.request.get(previewURL)
  expect(preview.status()).toBe(200)
  expect(await preview.text()).toContain('Native English content')
  await page.getByRole('button', { name: 'Publish' }).click()
  await expect(page.getByText('Published', { exact: true })).toBeVisible()
  await editor.fill('A changed draft should stay private')
  await expect(page.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible({
    timeout: 15000,
  })
  const live = await context.request.get(path)
  const html = await live.text()
  expect(html).toContain('Native English content')
  expect(html).not.toContain('A changed draft should stay private')
  const editorURL = page.url()
  await page.goto(path)
  await expect(
    page.getByRole('heading', { name: 'Browser verified post', exact: true }),
  ).toBeVisible()
  const anonymous = await context.browser()?.newContext()
  expect(anonymous).toBeDefined()
  const privatePage = await anonymous?.request.get(previewURL)
  expect(privatePage?.status()).toBe(401)
  await anonymous?.close()
  expect(errors).toEqual([])
  // Playwright's WebKit screenshot preparation injects an unnonced `body {}`.
  // Assert the complete application flow first; capture evidence afterwards.
  await page.goto(editorURL)
  await expect(editor).toContainText('A changed draft should stay private')
  expect(errors).toEqual([])
  await captureState(page, info, 'editor-saved-unpublished-change')
})

// The scanner clones styles into an iframe without preserving CSP nonces.
// Its dedicated context permits those test-only styles; the application test above enforces the real CSP.
test.describe('accessibility scanner', () => {
  test.use({ bypassCSP: true })
  test('saved editor and public reader have no axe violations', async ({ page }, info) => {
    const slug = `accessible-post-${crypto.randomUUID()}`
    await page.goto('/__fixture/login')
    await page.getByRole('button', { name: 'New post' }).click()
    await page.getByLabel('Document body', { exact: true }).fill('Accessible native content')
    await page.getByLabel('Title', { exact: true }).fill('Accessible post')
    await page.getByLabel('Slug', { exact: true }).fill(slug)
    await expect(page.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible({
      timeout: 15000,
    })
    await assertAccessible(page, info, { label: 'saved-editor' })
    await page.getByRole('button', { name: 'Publish' }).click()
    await expect(page.getByText('Published', { exact: true })).toBeVisible()
    await page.goto(`/posts/${slug}`)
    await expect(
      page.getByRole('heading', { name: 'Accessible post', exact: true }),
    ).toBeVisible()
    await assertAccessible(page, info, { label: 'public-reader' })
    await captureState(page, info, 'public-reader')
  })
})

test('slash keyboard control, formatting and plain-text paste use native editor commands', async ({
  page,
  context,
}) => {
  await page.goto('/__fixture/login')
  await page.getByRole('button', { name: 'New post' }).click()
  const body = page.getByLabel('Document body', { exact: true })
  await body.press('/')
  await expect(page.getByRole('listbox', { name: 'Insert block' })).toBeVisible()
  await body.pressSequentially('heading')
  await body.press('Enter')
  await expect(page.locator('.bn-block-content[data-content-type="heading"]')).toBeVisible()
  await body.pressSequentially('Native heading')
  await body.press('Enter')
  await body.pressSequentially('Format this paragraph')
  await body.press('ControlOrMeta+A')
  await page.getByRole('button', { name: 'Bold', exact: true }).click()
  await body.press('ArrowRight')
  await body.evaluate((element) => {
    const clipboard = new DataTransfer()
    clipboard.setData('text/plain', '<script>literal text</script> **plain**')
    clipboard.setData('text/html', '<img src=x onerror=alert(1)>')
    element.dispatchEvent(
      new ClipboardEvent('paste', {
        clipboardData: clipboard,
        bubbles: true,
        cancelable: true,
      }),
    )
  })
  await expect(body).toContainText('<script>literal text</script> **plain**')
  await expect(body.locator('img')).toHaveCount(0)
  await expect(page.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible({
    timeout: 15000,
  })
  const response = await context.request.get(
    new URL(page.url()).pathname.replace('/admin/documents/', '/api/admin/documents/'),
  )
  expect(response.status()).toBe(200)
})
