import { assertAccessible } from '~/tests/support/browser/accessibility'
import {
  EDITOR_WORKSPACE_DOCUMENT_ID,
  editorWorkspaceApi,
  editorWorkspaceDocument,
  editorWorkspaceWrites,
} from '../support/editor-workspace-fixtures'
import { openPublicationTab } from '../support/editor-workspace-ui'
import { editorWorkspaceCopy } from '../support/expected-copy'
import { serveApi } from '../support/http-fixtures'
import { mountSurface } from '../support/mount'
import { expect, test } from '../support/test'

// The device zone decides the picker's initial value and what the clear
// control restores; the case must not inherit the machine running it.
test.use({ timezoneId: 'Asia/Taipei' })

for (const [locale, width] of [
  ['en', 1440],
  ['zh', 390],
] as const) {
  test(`publication timezone is automatic and searchable in ${locale} at ${width}px`, async ({ page }, info) => {
    const copy = editorWorkspaceCopy[locale]
    const title = `Timezone picker ${crypto.randomUUID()}`
    const api = await serveApi(page, editorWorkspaceApi(editorWorkspaceDocument(title)))
    try {
      await page.setViewportSize({ width, height: 900 })
      await mountSurface(page, {
        surface: 'editor-workspace',
        locale,
        route: `/admin/documents/${EDITOR_WORKSPACE_DOCUMENT_ID}`,
      })
      // The entry names the document to open; this title only exists in the
      // session's document reply, so rendering it proves the real load ran.
      await expect(page.locator('.title-field input')).toHaveValue(title)
      await expect(page.getByLabel(copy.body, { exact: true })).toBeVisible()
      await openPublicationTab(page, locale)
      await page.getByRole('button', { name: copy.schedule, exact: true }).click()
      const timezone = page.getByRole('combobox', { name: copy.timezone, exact: true })
      await expect(timezone).toContainText('Asia/Taipei')
      await timezone.click()
      const search = page.getByRole('combobox', { name: copy.search, exact: true })
      await expect(search).toBeFocused()
      await search.fill('London')
      await expect(page.locator('.searchable-select-content')).toHaveCSS('opacity', '1')
      await page.screenshot({ path: info.outputPath(`timezone-search-${locale}-${width}.png`) })
      await page.getByRole('option', { name: /Europe\/London$/ }).click()
      await expect(timezone).toContainText('Europe/London')
      await timezone.click()
      await page.getByRole('button', { name: copy.device, exact: true }).click()
      await expect(timezone).toContainText('Asia/Taipei')
      await timezone.press('Enter')
      await search.fill('UTC')
      await search.press('ArrowDown')
      await search.press('Enter')
      await expect(timezone).toContainText('UTC')
      await timezone.evaluate(element => element.closest('.schedule-time-form')?.scrollIntoView({ block: 'start' }))
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await assertAccessible(page, info, { label: `timezone-${locale}-${width}` })
      await page.screenshot({ path: info.outputPath(`timezone-${locale}-${width}.png`) })
      // Choosing a timezone is a local form decision: it reads the known routes
      // and writes nothing until the author schedules the saved draft.
      expect(editorWorkspaceWrites(api.calls)).toEqual([])
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}
