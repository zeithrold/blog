import type { Locator, Page } from '@playwright/test'
import type { ApiService, Held } from '~/tests/components/support/http-fixtures'
import type { Locale } from '~/tests/support/browser/locale'
import {
  conflictCase,
  conflictCopy,
  conflictTexts,
  mountEditor,
  publicWriteCalls,
  servedDraftChange,
  writeCalls,
} from '~/tests/components/support/editor-history-remaining-fixtures'
import { apiKey, defer, failure } from '~/tests/components/support/http-fixtures'
import { expect, test } from '~/tests/components/support/test'
import { assertAccessible } from '~/tests/support/browser/accessibility'
import { horizontalBounds } from '~/tests/support/browser/layout'
import { labels } from '~/tests/support/browser/locale'

/**
 * The editor that holds a stale draft, with the refused save and the newer draft
 * the notice reads. `refresh` holds that read so the pending notice is visible.
 *
 * What the notice says, which variants and descriptions the choices carry, the
 * comparison's disclosure and before/after text, the stale recompute and the
 * request log are proved without a browser in
 * `tests/dom/history-conflict-remaining.test.tsx`. This case keeps only what needs
 * the real engine: the live BlockNote body, painted icons, viewport bounds, 44px
 * targets and the focus return after cancelling the replacement dialog.
 */
async function mountConflict(page: Page, options: {
  width: number
  locale: Locale
  refresh?: Held
}): Promise<{ api: ApiService, body: Locator }> {
  const { local, remote } = conflictCase()
  const api = await mountEditor(page, {
    document: local.initial,
    width: options.width,
    locale: options.locale,
    handlers: {
      'GET /api/admin/documents/:id': servedDraftChange({
        local: local.initial,
        remote,
        refresh: options.refresh,
      }),
      // The server refuses the save of a draft another window already replaced.
      'PUT /api/admin/documents/:id/revisions': () => failure(409, 'EDIT_CONFLICT'),
    },
  })
  const body = page.getByLabel(labels[options.locale].body, { exact: true })
  await expect(body).toBeVisible()
  await expect(page.locator('.title-field input')).toHaveValue(local.initial.document.meta.title)
  // Editing is what sends the refused save; the notice belongs to the refusal.
  await body.fill(conflictTexts.local)
  return { api, body }
}

/** The painted chrome and target sizes of the conflict actions. */
async function actionGeometry(page: Page, notice: Locator, locale: Locale, width: number): Promise<void> {
  const text = conflictCopy[locale]
  const compare = notice.getByRole('button', { name: text.compare, exact: true })
  await expect(compare.locator('svg[aria-hidden="true"]').first()).toBeVisible()
  for (const name of [text.keep, text.open]) {
    const action = notice.getByRole('button', { name, exact: true })
    await expect(action.locator('svg[aria-hidden="true"]')).toBeVisible()
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

/**
 * Opens the comparison and the changed paragraph it lists, which is the arrangement
 * a measurement or an axe scan needs. The disclosure state and the before/after
 * text are the jsdom case's; this only puts the row on screen.
 */
async function openChangedRow(notice: Locator, locale: Locale): Promise<Locator> {
  const text = conflictCopy[locale]
  const comparison = notice.getByRole('region', { name: text.comparison, exact: true })
  const differences = comparison.getByRole('region', { name: text.differences, exact: true })
  await expect(differences).toBeVisible()
  const changed = differences.locator('.diff-row[data-change="changed"]').first()
  await changed.locator('.diff-block-trigger').click()
  return changed
}

/** Opens the comparison and measures the changed paragraph it renders. */
async function measureChangedRow(page: Page, notice: Locator, locale: Locale): Promise<void> {
  await notice.getByRole('button', { name: conflictCopy[locale].compare, exact: true }).click()
  await horizontalBounds(page, await openChangedRow(notice, locale))
}

// While the newer draft is still being read, the notice that owns the conflict is
// the draft error: it explains the preserved edits. The merged notice replaces it.
test('a pending conflict refresh explains preserved document edits and merges into one actionable notice', async ({
  page,
}, info) => {
  const text = conflictCopy.zh
  const refresh = defer()
  const { api } = await mountConflict(page, { width: 320, locale: 'zh', refresh })
  try {
    const pending = page.getByRole('region', { name: text.pending, exact: true })
    await expect(pending).toBeVisible({ timeout: 15000 })
    // While the newer draft is read, the live editor already holds this window's
    // paragraph; the notice copy and its merge into one notice are the jsdom case's.
    await expect(page.getByLabel(labels.zh.body, { exact: true })).toContainText(conflictTexts.local)
    await horizontalBounds(page, pending)
    await pending.scrollIntoViewIfNeeded()
    await page.screenshot({ path: info.outputPath('conflict-refresh-pending-320-zh.png') })
    refresh.open()
    await expect(page.getByRole('region', { name: text.title, exact: true })).toBeVisible()
    await api.expectServed()
  }
  finally {
    refresh.open()
    await api.dispose()
  }
})

for (const width of [
  320,
  390,
  1440,
]) {
  for (const locale of ['en', 'zh'] as const) {
    test(`conflict choices and refreshed comparison remain accessible at ${width}px in ${locale}`, async ({
      page,
    }, info) => {
      const text = conflictCopy[locale]
      const { api, body } = await mountConflict(page, { width, locale })
      try {
        const notice = page.getByRole('region', { name: text.title, exact: true })
        await expect(notice).toBeVisible({ timeout: 15000 })
        const original = await body.elementHandle()
        await expect(body).toContainText(conflictTexts.local)
        await expect(notice.locator('.editor-notice-icon[aria-hidden="true"] svg')).toBeVisible()
        await horizontalBounds(page, notice)
        await actionGeometry(page, notice, locale, width)
        await notice.scrollIntoViewIfNeeded()
        await page.screenshot({ path: info.outputPath(`conflict-notice-${width}-${locale}.png`) })
        await measureChangedRow(page, notice, locale)
        await horizontalBounds(page, notice)
        await page.screenshot({ path: info.outputPath(`conflict-comparison-${width}-${locale}.png`) })
        // The edit a comparison would call stale is what the live editor keeps.
        await body.fill(conflictTexts.updated)
        const keep = notice.getByRole('button', { name: text.keep, exact: true })
        await keep.click()
        const confirmation = page.getByRole('dialog')
        await expect(confirmation).toBeVisible()
        await confirmation.getByRole('button', { name: text.cancel, exact: true }).click()
        await expect(confirmation).not.toBeVisible()
        await expect(keep).toBeFocused()
        // Cancelling keeps the live editor: the same element still owns the body.
        expect(await original.evaluate(element => element.isConnected)).toBe(true)
        await expect(body).toContainText(conflictTexts.updated)
        // The action path writes what the refusal already wrote: no second save.
        expect(writeCalls(api).map(call => apiKey(call.method, call.path)))
          .toEqual(['PUT /api/admin/documents/:id/revisions'])
        await original.dispose()
        await notice.getByRole('button', { name: text.open, exact: true }).click()
        await expect(body).toContainText(conflictTexts.server)
        await expect(notice).toHaveCount(0)
        // Opening the server version publishes nothing; it replaces the draft body.
        expect(publicWriteCalls(api)).toEqual([])
        await api.expectServed()
      }
      finally {
        await api.dispose()
      }
    })
  }
}

test.describe('accessibility scanner', () => {
  test.use({ bypassCSP: true })
  for (const scenario of [
    { width: 320, locale: 'zh' },
    { width: 1440, locale: 'en' },
  ] as const) {
    test(`conflict states are accessible at ${scenario.width}px in ${scenario.locale}`, async ({ page }, info) => {
      const { width, locale } = scenario
      const text = conflictCopy[locale]
      const { api } = await mountConflict(page, { width, locale })
      try {
        const notice = page.getByRole('region', { name: text.title, exact: true })
        await expect(notice).toBeVisible({ timeout: 15000 })
        await assertAccessible(page, info, { label: `conflict-collapsed-${width}-${locale}` })
        await notice.getByRole('button', { name: text.compare, exact: true }).click()
        await openChangedRow(notice, locale)
        await assertAccessible(page, info, { label: `conflict-expanded-${width}-${locale}` })
        await notice.getByRole('button', { name: text.keep, exact: true }).click()
        const confirmation = page.getByRole('dialog')
        await expect(confirmation).toBeVisible()
        await assertAccessible(page, info, { label: `conflict-confirmation-${width}-${locale}` })
        await confirmation.getByRole('button', { name: text.cancel, exact: true }).click()
        await api.expectServed()
      }
      finally {
        await api.dispose()
      }
    })
  }
})
