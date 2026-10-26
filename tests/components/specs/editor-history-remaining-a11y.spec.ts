import type { Page, TestInfo } from '@playwright/test'
import type { HistoryCase } from '~/tests/components/support/history-fixtures'
import {
  comparableHistoryCase,
  documentWithText,
  mountEditor,
  openContentTab,
  storeRecovery,
} from '~/tests/components/support/editor-history-remaining-fixtures'
import { historyCopy } from '~/tests/components/support/history-copy'
import { historyReads } from '~/tests/components/support/history-fixtures'
import { mountHistory } from '~/tests/components/support/history-surface'
import { serveApi } from '~/tests/components/support/http-fixtures'
import { expect, test } from '~/tests/components/support/test'
import { assertAccessible } from '~/tests/support/browser/accessibility'
import { labels } from '~/tests/support/browser/locale'

const recoveryText = 'A local recovery copy that was never sent to the server'

/** The Content tab's preview entry renders the unsaved draft in its own dialog. */
async function openPreview(page: Page): Promise<void> {
  const text = labels.en
  await openContentTab(page, 'en')
  await page.getByRole('button', { name: text.preview, exact: true }).click()
  await expect(page.getByRole('dialog', { name: text.dialog, exact: true })
    .getByRole('region', { name: text.reader, exact: true }))
    .toContainText('The current paragraph after its edit')
}

/** The stored local copy is offered by the real recovery notice after a reload. */
async function localRecovery(page: Page, fixture: HistoryCase): Promise<void> {
  await storeRecovery(page, {
    documentId: fixture.initial.documentId,
    baseRevisionId: fixture.initial.headRevisionId,
    document: documentWithText(fixture.initial.document, { text: recoveryText }),
  })
  await page.reload()
  await expect(page.getByLabel(labels.en.body, { exact: true })).toBeVisible()
}

/**
 * Both draft surfaces are scanned where the author sees them: the open preview
 * dialog and the notice offered by the reloaded editor.
 */
async function scanDraftSurfaces(
  page: Page,
  info: TestInfo,
  width: number,
  fixture: HistoryCase,
): Promise<void> {
  await expect(page.getByLabel(labels.en.body, { exact: true })).toBeVisible()
  await openPreview(page)
  await assertAccessible(page, info, { label: `draft-preview-${width}` })
  await page.getByRole('dialog', { name: labels.en.dialog, exact: true })
    .getByRole('button', { name: labels.en.closePreview, exact: true })
    .click()
  await expect(page.getByRole('dialog', { name: labels.en.dialog, exact: true })).not.toBeVisible()
  if (width < 1100) {
    await page.getByRole('dialog', { name: labels.en.settings, exact: true })
      .getByRole('button', { name: labels.en.close, exact: true })
      .click()
  }
  await localRecovery(page, fixture)
  const recovery = page.getByRole('region', { name: labels.en.recovery, exact: true })
  await expect(recovery).toBeVisible()
  await assertAccessible(page, info, { label: `recovery-${width}` })
  await recovery.getByRole('button', { name: labels.en.dismiss, exact: true }).click()
  await expect(recovery).toHaveCount(0)
}

test.describe('accessibility scanner', () => {
  // Axe creates its own style iframe; the interaction cases run under the same harness.
  test.use({ bypassCSP: true })
  for (const width of [390, 1440]) {
    test(`draft preview and local recovery are accessible at ${width}px`, async ({ page }, info) => {
      const fixture = comparableHistoryCase()
      const api = await mountEditor(page, {
        document: fixture.initial,
        width,
        locale: 'en',
      })
      try {
        await scanDraftSurfaces(page, info, width, fixture)
        await api.expectServed()
      }
      finally {
        await api.dispose()
      }
    })

    test(`history comparison and confirmation are accessible at ${width}px`, async ({ page }, info) => {
      const copy = historyCopy.en
      const fixture = comparableHistoryCase()
      const api = await serveApi(page, historyReads(fixture))
      try {
        await page.setViewportSize({ width, height: 844 })
        await mountHistory(page, 'en')
        if (width <= 700) {
          await page.getByRole('combobox', { name: copy.selected, exact: true }).click()
          await page.getByRole('option', { name: new RegExp(`^${copy.revision} 2(?:\\s|$)`) }).click()
        }
        else {
          await page.locator('.history-sidebar').getByRole('button', {
            name: new RegExp(`^${copy.revision} 2(?:\\s|$)`),
          }).click()
        }
        const changed = page.locator('.diff-row[data-change="changed"]')
        await expect(changed).toHaveCount(1)
        await changed.locator('.diff-block-trigger').click()
        await expect(changed.locator('[data-side="after"]')).toContainText('The historical paragraph before its edit')
        await assertAccessible(page, info, { label: `history-comparison-${width}` })
        await page.getByRole('button', { name: copy.restore, exact: true }).click()
        const confirmation = page.getByRole('dialog')
        await expect(confirmation).toBeVisible()
        await assertAccessible(page, info, { label: `history-confirmation-${width}` })
        await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click()
        await expect(confirmation).not.toBeVisible()
        await api.expectServed()
      }
      finally {
        await api.dispose()
      }
    })
  }
})
