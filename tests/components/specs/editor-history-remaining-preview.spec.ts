import type { Locator, Page } from '@playwright/test'
import type { Locale } from '~/tests/support/browser/locale'
import {
  documentWithText,
  expectSaved,
  mountEditor,
  openContentTab,
  storeRecovery,
  writeCalls,
} from '~/tests/components/support/editor-history-remaining-fixtures'
import { editorWorkspaceSaveAck } from '~/tests/components/support/editor-workspace-fixtures'
import { historyCase } from '~/tests/components/support/history-fixtures'
import { defer } from '~/tests/components/support/http-fixtures'
import { expect, test } from '~/tests/components/support/test'
import { horizontalBounds } from '~/tests/support/browser/layout'
import { labels } from '~/tests/support/browser/locale'

const unsavedText = 'The current unsaved paragraph, including 当前未保存的内容'
const recoveryText = 'A local recovery copy that was never sent to the server'

/**
 * The open preview dialog: the facts only the real page holds.
 *
 * One provider-owned preview, the reader's unsaved draft, the absence of an
 * alert, the closed state and the zero-request proof live in
 * `tests/dom/history-preview-remaining-entries.test.tsx`. This helper keeps the
 * dialog's real geometry, the text the live BlockNote editor snapshotted and the
 * native focus delivery that surrounds it.
 */
async function previewContent(page: Page, locale: Locale): Promise<Locator> {
  const text = labels[locale]
  const dialog = page.getByRole('dialog', { name: text.dialog, exact: true })
  await expect(dialog).toBeVisible()
  // The reader renders the paragraph typed into the live editor's snapshot.
  await expect(dialog.getByRole('region', { name: text.reader, exact: true })).toContainText(unsavedText)
  await horizontalBounds(page, dialog)
  await horizontalBounds(page, dialog.getByRole('button', { name: text.closePreview, exact: true }))
  await expect.poll(async () => await dialog.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    return bounds.top >= 0 && bounds.bottom <= window.innerHeight
  })).toBe(true)
  return dialog
}

/** The Content tab opens one preview entry that owns its own dialog and focus. */
async function fromSettings(page: Page, locale: Locale, width: number, screenshot: string): Promise<void> {
  const text = labels[locale]
  await openContentTab(page, locale)
  // The Content tab's single entry and its absent saved-revision link are proved
  // against the real mounted `ContentSettings` in jsdom; this case keeps the real
  // drawer/tab wiring around it and the geometry that follows.
  const trigger = page.getByRole('button', { name: text.preview, exact: true })
  await trigger.click()
  const dialog = await previewContent(page, locale)
  await page.screenshot({ path: screenshot })
  await dialog.getByRole('button', { name: text.closePreview, exact: true }).click()
  // Closing returns native focus to the entry that opened the preview.
  await expect(trigger).toBeFocused()
  if (width < 1100) {
    const drawer = page.getByRole('dialog', { name: text.settings, exact: true })
    await expect(drawer).toBeVisible()
    await drawer.getByRole('button', { name: text.close, exact: true }).click()
    await expect(drawer).not.toBeVisible()
  }
}

/** The action menu exposes the same single preview entry and closes behind it. */
async function fromMore(page: Page, locale: Locale, width: number): Promise<void> {
  const text = labels[locale]
  const trigger = page.getByRole('button', { name: text.more, exact: true })
  await trigger.click()
  const panel = width <= 700 ? page.getByRole('dialog') : page.getByRole('menu')
  const role = width <= 700 ? 'button' : 'menuitem'
  const preview = panel.getByRole(role, { name: text.preview, exact: true })
  await preview.click()
  const dialog = await previewContent(page, locale)
  await page.keyboard.press('Escape')
  // Escape is native key delivery: it closes the preview and returns focus to the menu trigger.
  await expect(dialog).not.toBeVisible()
  await expect(trigger).toBeFocused()
}

for (const width of [
  320,
  390,
  1440,
]) {
  for (const locale of ['en', 'zh'] as const) {
    test(`both preview entries show the unsaved draft without remounting at ${width}px in ${locale}`, async ({
      page,
    }, info) => {
      const text = labels[locale]
      const fixture = historyCase({
        body: 'The saved paragraph before editing',
        latestBody: 'The saved paragraph before editing',
      })
      // A save that has not answered yet is what makes the draft unsaved here.
      const autosave = defer()
      const api = await mountEditor(page, {
        document: fixture.initial,
        width,
        locale,
        handlers: {
          'PUT /api/admin/documents/:id/revisions': async (call) => {
            await autosave.promise
            return editorWorkspaceSaveAck(call)
          },
        },
      })
      const body = page.getByLabel(text.body, { exact: true })
      try {
        await expect(body).toBeVisible()
        await body.fill(unsavedText)
        const original = await body.elementHandle()
        await fromSettings(page, locale, width, info.outputPath(`draft-preview-${width}-${locale}.png`))
        await fromMore(page, locale, width)
        // Neither entry recreated the editor that holds the unsaved paragraph.
        expect(await original.evaluate(element => element.isConnected)).toBe(true)
        await expect(body).toContainText(unsavedText)
        await page.screenshot({ path: info.outputPath(`preview-return-${width}-${locale}.png`) })
        await original.dispose()
        autosave.open()
        await expectSaved(page, locale)
        await api.expectServed()
      }
      finally {
        autosave.open()
        await api.dispose()
      }
    })
  }
}

for (const width of [320, 390]) {
  for (const locale of ['en', 'zh'] as const) {
    test(`local recovery is readable, dismissible and recoverable at ${width}px in ${locale}`, async ({
      page,
    }, info) => {
      const text = labels[locale]
      const fixture = historyCase({
        body: 'The unchanged server paragraph',
        latestBody: 'The unchanged server paragraph',
      })
      const api = await mountEditor(page, {
        document: fixture.initial,
        width,
        locale,
      })
      const notice = page.getByRole('region', { name: text.recovery, exact: true })
      const body = page.getByLabel(text.body, { exact: true })
      try {
        await expect(body).toBeVisible()
        // The copy is stored by the product's own IndexedDB schema, then read on mount.
        await storeRecovery(page, {
          documentId: fixture.initial.documentId,
          baseRevisionId: fixture.initial.headRevisionId,
          document: documentWithText(fixture.initial.document, { text: recoveryText }),
        })
        await page.reload()
        await expect(body).toBeVisible()
        await expect(notice).toBeVisible()
        await expect(notice.locator('.editor-notice-icon[aria-hidden="true"] svg')).toBeVisible()
        await horizontalBounds(page, notice)
        for (const name of [text.recover, text.dismiss]) {
          const action = notice.getByRole('button', { name, exact: true })
          await expect(action.locator('svg[aria-hidden="true"]')).toBeVisible()
          await horizontalBounds(page, action)
        }
        await page.screenshot({ path: info.outputPath(`recovery-${width}-${locale}.png`) })
        await notice.getByRole('button', { name: text.dismiss, exact: true }).click()
        await expect(notice).toHaveCount(0)
        await expect(body).toContainText('The unchanged server paragraph')
        await page.reload()
        await expect(body).toBeVisible()
        // Dismissing hides the notice for this session; the stored copy survives a reload.
        await expect(notice).toBeVisible()
        // Reading and dismissing a local copy sends nothing to the server.
        expect(writeCalls(api)).toEqual([])
        await notice.getByRole('button', { name: text.recover, exact: true }).click()
        await expect(body).toContainText(recoveryText)
        await expect(notice).toHaveCount(0)
        await api.expectServed()
      }
      finally {
        await api.dispose()
      }
    })
  }
}
