import type { Page } from '@playwright/test'
import type { Locale } from '~/tests/support/browser/locale'
import { comparableHistoryCase, mountEditor } from '~/tests/components/support/editor-history-remaining-fixtures'
import { openPublicationTab } from '~/tests/components/support/editor-workspace-ui'
import { historyCopy } from '~/tests/components/support/history-copy'
import { historyReads } from '~/tests/components/support/history-fixtures'
import { mountHistory } from '~/tests/components/support/history-surface'
import { serveApi } from '~/tests/components/support/http-fixtures'
import { expect, test } from '~/tests/components/support/test'
import { horizontalBounds } from '~/tests/support/browser/layout'
import { labels } from '~/tests/support/browser/locale'

/**
 * The compact list's painted icons, 44px targets and horizontal bounds.
 *
 * `history-state-editor-history` proves the labels, the rows and the preview link.
 * This case keeps the icons' paint and the hit targets, which jsdom cannot measure.
 */
async function compactGeometry(page: Page, locale: Locale, width: number): Promise<void> {
  const text = labels[locale]
  await openPublicationTab(page, locale)
  const history = page.getByRole('region', { name: text.history, exact: true })
  await history.getByRole('button', { name: text.history, exact: true }).click()
  const rows = history.locator('.revision-list li')
  const older = rows.filter({ has: page.getByText(`${text.revision} 2`, { exact: true }) })
  const preview = older.getByRole('link', { name: text.preview, exact: true })
  const restore = older.getByRole('button', { name: text.restore, exact: true })
  await expect(preview.locator('svg')).toBeVisible()
  await expect(restore.locator('svg')).toBeVisible()
  for (const action of [preview, restore]) {
    await horizontalBounds(page, action)
    if (width <= 700) {
      const bounds = await action.boundingBox()
      expect(bounds?.width).toBeGreaterThanOrEqual(44)
      expect(bounds?.height).toBeGreaterThanOrEqual(44)
    }
  }
}

/**
 * The standalone page's listbox, selected panel and expanded diff geometry.
 *
 * The selection, comparison and label values are proved by the jsdom selection
 * cases; this case keeps only the viewport bounds a real engine supplies.
 */
async function compareGeometry(
  page: Page,
  view: { width: number, locale: Locale },
): Promise<void> {
  const { width, locale } = view
  const copy = historyCopy[locale]
  await page.setViewportSize({ width, height: 740 })
  await mountHistory(page, locale)
  const selected = page.locator('.history-selection')
  const revision = new RegExp(`^${copy.revision} 2(?:\\s|$)`)
  if (width <= 700) {
    await page.getByRole('combobox', { name: copy.selected, exact: true }).click()
    await horizontalBounds(page, page.getByRole('listbox'))
    await page.getByRole('option', { name: revision }).click()
  }
  else {
    await page.locator('.history-sidebar').getByRole('button', { name: revision }).click()
  }
  await horizontalBounds(page, selected)
  const baseline = page.getByRole('combobox', { name: copy.compare, exact: true })
  await baseline.click()
  await page.getByRole('option', { name: new RegExp(`^${copy.revision} 3(?:\\s|$)`) }).click()
  const changed = page.locator('.diff-row[data-change="changed"]')
  await changed.locator('.diff-block-trigger').click()
  await horizontalBounds(page, changed)
}

for (const width of [
  320,
  390,
  1440,
]) {
  for (const locale of ['en', 'zh'] as const) {
    test(`history compares revisions with readable labels at ${width}px in ${locale}`, async ({ page }) => {
      // The compact list belongs to the editor; the standalone page reads its own store.
      const editorFixture = comparableHistoryCase()
      const editor = await mountEditor(page, {
        document: editorFixture.initial,
        width,
        locale,
        handlers: {
          'GET /api/admin/documents/:id/revisions': () => ({ body: editorFixture.history }),
        },
      })
      try {
        // The editor has loaded before its compact history is opened.
        await expect(page.locator('.title-field input')).toHaveValue('The current draft title')
        await compactGeometry(page, locale, width)
        await editor.expectServed()
      }
      finally {
        await editor.dispose()
      }
      const fixture = comparableHistoryCase()
      const api = await serveApi(page, historyReads(fixture))
      try {
        await compareGeometry(page, { width, locale })
        await api.expectServed()
      }
      finally {
        await api.dispose()
      }
    })
  }
}
