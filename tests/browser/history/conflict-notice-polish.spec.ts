import type { Locator, Page } from '@playwright/test'
import type { Locale } from '~/tests/support/browser/locale'
import { openDocumentSchema } from '@/contracts/documents'
import { assertAccessible } from '~/tests/support/browser/accessibility'
import { writeDocument } from '~/tests/support/browser/document'
import { fixture } from '~/tests/support/browser/document-fixture'
import { horizontalBounds } from '~/tests/support/browser/layout'
import { labels, setLocale } from '~/tests/support/browser/locale'
import { expect, test } from '~/tests/support/browser/test'

const copy = {
  en: {
    title: 'Draft conflict',
    comparison: 'Conflict comparison',
    compare: 'Compare changes',
    differences: 'Revision differences',
    keep: 'Keep local edits',
    open: 'Use server version',
    keepHelp: 'Save as a new draft revision.',
    openHelp: 'Your local edits stay in a recovery copy.',
    stale: 'Local content changed after this comparison',
    cancel: 'Cancel',
  },
  zh: {
    title: '草稿存在冲突',
    comparison: '冲突内容对比',
    compare: '查看差异',
    differences: '修订差异',
    keep: '保留本地修改',
    open: '使用服务器版本',
    keepHelp: '保存为新的草稿修订。',
    openHelp: '本地修改会保留为恢复副本。',
    stale: '本地内容已继续修改',
    cancel: '取消',
  },
} as const
const serverText = 'The server paragraph saved by the other window'
const localText = 'The local paragraph that remains preserved in this window'
const updatedText = 'The updated local paragraph after comparing both drafts'
const pageErrors = new WeakMap<Page, string[]>()
test.beforeEach(({ page, context }) => {
  const errors: string[] = []
  pageErrors.set(page, errors)
  page.on('pageerror', error => errors.push(error.message))
  context.on('page', opened => opened.on('pageerror', error => errors.push(error.message)))
})
test.afterEach(({ page }) => {
  expect(pageErrors.get(page) ?? []).toEqual([])
})

async function conflictFixture(page: Page, locale: Locale, remoteGate?: Promise<void>): Promise<{
  local: Page
  path: string
  head: string
}> {
  const ack = await writeDocument(page, fixture('The initial paragraph before the two windows diverged'))
  await setLocale(page, locale)
  const local = await page.context().newPage()
  const viewport = page.viewportSize()
  if (viewport !== null) {
    await local.setViewportSize(viewport)
  }
  await local.goto(page.url())
  const bodyName = labels[locale].body
  await expect(local.getByLabel(bodyName, { exact: true })).toBeVisible()
  await page.getByLabel(bodyName, { exact: true }).fill(serverText)
  await expect(page.getByRole('status').filter({ hasText: new RegExp(`^${labels[locale].saved}$`) }))
    .toBeVisible({ timeout: 15000 })
  const path = `/api/admin/documents/${ack.documentId}`
  const server = openDocumentSchema.parse(await (await page.request.get(path)).json())
  if (remoteGate !== undefined) {
    await local.route(`**${path}`, async (route) => {
      await remoteGate
      await route.continue()
    })
  }
  await local.getByLabel(bodyName, { exact: true }).fill(localText)
  if (remoteGate === undefined) {
    await expect(local.getByRole('region', { name: copy[locale].title, exact: true }))
      .toBeVisible({ timeout: 15000 })
  }
  return { local, path, head: server.headRevisionId }
}

async function accessibleActions(page: Page, notice: Locator, locale: Locale, width: number): Promise<void> {
  const text = copy[locale]
  const compare = notice.getByRole('button', { name: text.compare, exact: true })
  await expect(compare).toHaveAttribute('data-variant', 'ghost')
  await expect(compare).toHaveAttribute('aria-expanded', 'false')
  await expect(compare.locator('svg[aria-hidden="true"]').first()).toBeVisible()
  for (const name of [text.keep, text.open]) {
    const action = notice.getByRole('button', { name, exact: true })
    await expect(action).toHaveAttribute('data-variant', 'outline')
    await expect(action.locator('svg[aria-hidden="true"]')).toBeVisible()
    await expect(action).toHaveAttribute('aria-describedby', /.+/)
    await expect(action).toHaveAccessibleDescription(name === text.keep ? text.keepHelp : text.openHelp)
  }
  for (const name of [
    text.compare,
    text.keep,
    text.open,
  ]) {
    const action = notice.getByRole('button', { name, exact: true })
    await horizontalBounds(page, action)
    if (width <= 700) {
      expect((await action.boundingBox())?.height).toBeGreaterThanOrEqual(44)
    }
  }
}

test('a pending conflict refresh explains preserved document edits and merges into one actionable notice', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 740 })
  let release: () => void = () => {}
  const remoteGate = new Promise<void>((resolve) => {
    release = resolve
  })
  const { local } = await conflictFixture(page, 'zh', remoteGate)
  try {
    const pending = local.getByRole('region', { name: '草稿已在其他位置更新', exact: true })
    await expect(pending).toBeVisible({ timeout: 15000 })
    await expect(pending.getByRole('alert')).toContainText('你的修改已保留')
    await expect(pending).not.toContainText(/catalog|分类项/i)
    await expect(local.locator('.editor-notice[data-tone="conflict"]')).toHaveCount(1)
    await expect(local.getByLabel(labels.zh.body, { exact: true })).toContainText(localText)
    await horizontalBounds(local, pending)
    await pending.scrollIntoViewIfNeeded()
    await local.screenshot({ path: info.outputPath('conflict-refresh-pending-320-zh.png') })
  }
  finally {
    release()
  }
  await expect(local.getByRole('region', { name: copy.zh.title, exact: true })).toBeVisible()
  await expect(local.getByRole('region', { name: '草稿已在其他位置更新', exact: true })).toHaveCount(0)
  await expect(local.getByRole('alert')).toHaveCount(0)
  await expect(local.locator('.editor-notice[data-tone="conflict"]')).toHaveCount(1)
  await local.close()
})

async function expandDifference(page: Page, comparison: Locator, locale: Locale, local: string): Promise<void> {
  const differences = comparison.getByRole('region', { name: copy[locale].differences, exact: true })
  await expect(differences).toBeVisible()
  const changed = differences.locator('.diff-row[data-change="changed"]')
  await expect(changed).toHaveCount(1)
  await changed.locator('.diff-block-trigger').click()
  await expect(changed.locator('[data-side="before"]')).toContainText(serverText)
  await expect(changed.locator('[data-side="after"]')).toContainText(local)
  await horizontalBounds(page, changed)
}

async function compareAndRefresh(page: Page, notice: Locator, locale: Locale): Promise<void> {
  const text = copy[locale]
  const compare = notice.getByRole('button', { name: text.compare, exact: true })
  const comparison = notice.getByRole('region', { name: text.comparison, exact: true })
  await compare.click()
  await expect(compare).toHaveAttribute('aria-expanded', 'true')
  await expandDifference(page, comparison, locale, localText)
  await compare.click()
  await expect(compare).toHaveAttribute('aria-expanded', 'false')
  await expect(comparison.getByRole('region', { name: text.differences, exact: true })).not.toBeVisible()
  await compare.click()
  await expect(compare).toHaveAttribute('aria-expanded', 'true')
  await expect(comparison.getByRole('region', { name: text.differences, exact: true })).toBeVisible()
  await page.getByLabel(labels[locale].body, { exact: true }).fill(updatedText)
  const stale = comparison.getByRole('status').filter({ hasText: text.stale })
  await expect(stale).toBeVisible()
  await compare.click()
  await expect(compare).toHaveAttribute('aria-expanded', 'true')
  await expect(stale).toHaveCount(0)
  await expandDifference(page, comparison, locale, updatedText)
}

for (const width of [
  320,
  390,
  1440,
]) {
  for (const locale of ['en', 'zh'] as const) {
    test(`conflict choices and refreshed comparison remain accessible at ${width}px in ${locale}`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: 740 })
      const { local, path, head } = await conflictFixture(page, locale)
      const body = local.getByLabel(labels[locale].body, { exact: true })
      const original = await body.elementHandle()
      const notice = local.getByRole('region', { name: copy[locale].title, exact: true })
      const writes: string[] = []
      local.on('request', (request) => {
        if (request.url().includes(path) && request.method() !== 'GET') {
          writes.push(request.url())
        }
      })
      await expect(body).toContainText(localText)
      await expect(local.locator('.editor-notice[data-tone="conflict"]')).toHaveCount(1)
      await expect(local.getByRole('alert')).toHaveCount(0)
      await expect(notice).not.toContainText(/catalog|分类项/i)
      await expect(notice.locator('.editor-notice-icon[aria-hidden="true"] svg')).toBeVisible()
      await horizontalBounds(local, notice)
      await accessibleActions(local, notice, locale, width)
      await notice.scrollIntoViewIfNeeded()
      await local.screenshot({ path: info.outputPath(`conflict-notice-${width}-${locale}.png`) })
      await compareAndRefresh(local, notice, locale)
      await horizontalBounds(local, notice)
      await local.screenshot({ path: info.outputPath(`conflict-comparison-${width}-${locale}.png`) })
      const keep = notice.getByRole('button', { name: copy[locale].keep, exact: true })
      await keep.click()
      const confirmation = local.getByRole('dialog')
      await expect(confirmation).toBeVisible()
      await confirmation.getByRole('button', { name: copy[locale].cancel, exact: true }).click()
      await expect(confirmation).not.toBeVisible()
      await expect(keep).toBeFocused()
      expect(await original.evaluate(element => element.isConnected)).toBe(true)
      await expect(body).toContainText(updatedText)
      const server = openDocumentSchema.parse(await (await page.request.get(path)).json())
      expect(server.headRevisionId).toBe(head)
      expect(writes).toEqual([])
      await original.dispose()
      await notice.getByRole('button', { name: copy[locale].open, exact: true }).click()
      await expect(body).toContainText(serverText)
      await expect(notice).toHaveCount(0)
      await local.close()
    })
  }
}

test.describe('accessibility scanner', () => {
  // Axe's style iframe needs its own test context; interaction cases use the real application CSP.
  test.use({ bypassCSP: true })
  test.beforeEach(async ({ context }) => {
    // WebKit reports Axe's cross-origin CSS preload as an uncaught XHR error.
    // Scanner contexts use system font fallbacks; interaction cases retain production fonts.
    await context.route('https://fonts.googleapis.com/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/css',
        headers: { 'access-control-allow-origin': '*' },
        body: '/* Accessibility scans use local system font fallbacks. */',
      })
    })
  })
  for (const scenario of [
    { width: 320, locale: 'zh' },
    { width: 1440, locale: 'en' },
  ] as const) {
    test(`conflict states are accessible at ${scenario.width}px in ${scenario.locale}`, async ({ page }, info) => {
      const { width, locale } = scenario
      await page.setViewportSize({ width, height: 740 })
      const { local } = await conflictFixture(page, locale)
      const notice = local.getByRole('region', { name: copy[locale].title, exact: true })
      await assertAccessible(local, info, { label: `conflict-collapsed-${width}-${locale}` })
      await notice.getByRole('button', { name: copy[locale].compare, exact: true }).click()
      const comparison = notice.getByRole('region', { name: copy[locale].comparison, exact: true })
      await expandDifference(local, comparison, locale, localText)
      await assertAccessible(local, info, { label: `conflict-expanded-${width}-${locale}` })
      await notice.getByRole('button', { name: copy[locale].keep, exact: true }).click()
      const confirmation = local.getByRole('dialog')
      await expect(confirmation).toBeVisible()
      await assertAccessible(local, info, { label: `conflict-confirmation-${width}-${locale}` })
      await confirmation.getByRole('button', { name: copy[locale].cancel, exact: true }).click()
      await local.close()
    })
  }
})
