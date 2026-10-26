import type { Locator, Page } from '@playwright/test'
import type { DocumentEntry } from '~/tests/components/support/domain-fixtures'
import type { DocumentCopy } from '~/tests/components/support/expected-copy'
import type { ApiService, Held } from '~/tests/components/support/http-fixtures'
import {
  acknowledgementFor,
  documentEntry,
  documentFilters,
  documentsPage,
} from '~/tests/components/support/domain-fixtures'
import { documentsCopy } from '~/tests/components/support/expected-copy'
import { defer, failure, lostResponse, serveApi } from '~/tests/components/support/http-fixtures'
import { mountSurface } from '~/tests/components/support/mount'
import { expect, test } from '~/tests/components/support/test'
import { horizontalBounds } from '~/tests/support/browser/layout'

async function choose(page: Page, label: string, option: string): Promise<void> {
  await page.getByRole('combobox', { name: label, exact: true }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

/** The trash row the case restores, and the row that must survive beside it. */
async function trashRows(page: Page, copy: DocumentCopy, rows: {
  target: string
  other: string
}): Promise<{ row: Locator, other: Locator, restore: Locator }> {
  await choose(page, copy.state, copy.trash)
  const items = page.getByRole('list', { name: copy.title, exact: true }).getByRole('listitem')
  const row = items.filter({ hasText: rows.target })
  return {
    row,
    other: items.filter({ hasText: rows.other }),
    restore: row.getByRole('button', { name: copy.restore, exact: true }),
  }
}

/** The action stays inside the list panel and never scrolls its own label. */
async function expectRestoreBounds(page: Page, control: Locator): Promise<void> {
  await horizontalBounds(page, control)
  const edges = await control.evaluate(element => ({
    button: element.getBoundingClientRect().right,
    panel: element.closest('.document-list-panel')?.getBoundingClientRect().right ?? 0,
  }))
  expect(edges.button).toBeLessThanOrEqual(edges.panel)
  expect(await control.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
}

/**
 * Serves two trash rows and the restore, then holds the refresh the restore
 * starts so the case can read the in-flight and failed states. The request after
 * the refused one returns the list as the committed restore left it.
 */
async function serveTrashRestore(page: Page, input: {
  readonly target: DocumentEntry
  readonly other: DocumentEntry
  readonly refreshed: readonly DocumentEntry[]
}): Promise<{ api: ApiService, held: Held, captured: Held }> {
  const held = defer()
  const captured = defer()
  let calls = 0
  const api = await serveApi(page, {
    'GET /api/admin/documents': async () => {
      calls += 1
      if (calls <= 2) {
        return { body: documentsPage([input.target, input.other]) }
      }
      if (calls === 3) {
        captured.open()
        await held.promise
        return failure(503, 'UNAVAILABLE')
      }
      return { body: documentsPage([
        ...input.refreshed,
      ]) }
    },
    'POST /api/admin/documents/:id/restore-deleted': () => ({
      body: acknowledgementFor(input.target, { version: input.target.version + 1 }),
    }),
  })
  return { api, held, captured }
}

/** The failed-refresh alert is a real, focused browser surface. */
async function expectRestoreNotices(page: Page): Promise<void> {
  const alert = page.getByRole('alert')
  await expect(alert).toBeInViewport()
  await expect(alert).toBeFocused()
}

test('pagination failure alert receives native focus', async ({ page }) => {
  const repeated = documentEntry({ title: 'Boundary repeated document' })
  const first = [
    repeated,
    ...Array.from({ length: 49 }, (_, index) => documentEntry({
      title: `Boundary document ${index}`,
      updatedAt: Date.UTC(2026, 0, 1) - index,
    })),
  ]
  const next = documentEntry({ title: 'Boundary next page document' })
  const cursors: (string | null)[] = []
  const api = await serveApi(page, {
    'GET /api/admin/documents': (call) => {
      const { cursor } = documentFilters(call.query)
      cursors.push(cursor)
      if (cursors.length === 2) {
        return failure(503, 'UNAVAILABLE')
      }
      return {
        body: documentsPage(cursor === null ? first : [repeated, next], cursor === null ? 'boundary-next' : null),
      }
    },
  })
  try {
    await mountSurface(page, { surface: 'documents' })
    await page.getByRole('button', { name: 'Load more', exact: true }).click()
    const alert = page.getByRole('alert')
    await expect(alert).toBeInViewport()
    await expect(alert).toBeFocused()
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

test('failed refresh alert stays in bounds and receives native focus', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  const prefix = `Restore boundary ${crypto.randomUUID()}`
  const target = documentEntry({ title: `${prefix} target`, version: 2 })
  const other = documentEntry({ title: `${prefix} other` })
  const { api, held, captured } = await serveTrashRestore(page, { target, other, refreshed: [other] })
  try {
    await mountSurface(page, { surface: 'documents' })
    const copy = documentsCopy.en
    const { other: otherRow, restore } = await trashRows(page, copy, {
      target: target.title,
      other: other.title,
    })
    const sibling = otherRow.getByRole('button', { name: copy.restore, exact: true })
    await expectRestoreBounds(page, restore)
    await page.screenshot({ path: info.outputPath('trash-before-restore-en.png') })

    await restore.click()
    await captured.promise
    held.open()

    await expectRestoreNotices(page)
    await expectRestoreBounds(page, sibling)
    await page.setViewportSize({ width: 800, height: 1000 })
    await expectRestoreBounds(page, sibling)
    await page.setViewportSize({ width: 1440, height: 1000 })
    await horizontalBounds(page, page.getByRole('alert'))
    await page.screenshot({ path: info.outputPath('trash-refresh-failed-en.png') })

    await api.expectServed()
  }
  finally {
    held.open()
    await api.dispose()
  }
})

test('restore notices keep their bounds in Chinese at 320px', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 900 })
  const prefix = `窄屏恢复 ${crypto.randomUUID()}`
  const target = documentEntry({ title: `${prefix} target`, version: 2 })
  const other = documentEntry({ title: `${prefix} other` })
  const { api, held, captured } = await serveTrashRestore(page, { target, other, refreshed: [other] })
  try {
    await mountSurface(page, { surface: 'documents', locale: 'zh' })
    const copy = documentsCopy.zh
    const { restore } = await trashRows(page, copy, {
      target: target.title,
      other: other.title,
    })
    await horizontalBounds(page, restore)
    await restore.click()
    await captured.promise
    held.open()
    const alert = page.getByRole('alert')
    await horizontalBounds(page, alert)
    await page.screenshot({ path: info.outputPath('trash-refresh-failed-zh.png') })
    await api.expectServed()
  }
  finally {
    held.open()
    await api.dispose()
  }
})

test('restored status receives native focus after retry', async ({ page }) => {
  const target = documentEntry({ title: 'Lost response target' })
  const other = documentEntry({ title: 'Lost response other' })
  let committed = false
  let posts = 0
  const api = await serveApi(page, {
    'GET /api/admin/documents': () => ({ body: documentsPage(committed ? [other] : [target, other]) }),
    'POST /api/admin/documents/:id/restore-deleted': () => {
      posts += 1
      if (posts === 1) {
        return lostResponse()
      }
      committed = true
      return { body: acknowledgementFor(target, { version: target.version + 1 }) }
    },
  })
  try {
    await mountSurface(page, { surface: 'documents' })
    const copy = documentsCopy.en
    const { restore } = await trashRows(page, copy, {
      target: target.title,
      other: other.title,
    })
    await restore.click()
    await page.getByRole('button', { name: copy.retry, exact: true }).click()
    await expect(page.getByRole('status')).toBeFocused()
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})
