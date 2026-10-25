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
import { defer, expectRetriedWrite, failure, lostResponse, serveApi } from '~/tests/components/support/http-fixtures'
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
  await expect(items).toHaveCount(2)
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

/** A failed refresh reports the load error and still reports the commit. */
async function expectRestoreNotices(
  page: Page,
  copy: DocumentCopy,
  row: Locator,
  sibling: Locator,
): Promise<void> {
  const alert = page.getByRole('alert')
  await expect(alert).toContainText(copy.loadError)
  await expect(alert).toBeInViewport()
  await expect(alert).toBeFocused()
  await expect(page.getByRole('status').filter({ hasText: copy.restored })).toBeVisible()
  await expect(sibling).toBeEnabled()
  await expect(row).toHaveCount(0)
}

/** Try again reloads the list and keeps what the user had typed. */
async function expectRetryRecovers(
  page: Page,
  copy: DocumentCopy,
  row: Locator,
  otherRow: Locator,
): Promise<void> {
  await page.getByRole('button', { name: copy.retry, exact: true }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('searchbox', { name: copy.search, exact: true }))
    .toHaveValue('Unsubmitted search text')
  await expect(page.getByRole('combobox', { name: copy.state, exact: true })).toContainText(copy.trash)
  await expect(otherRow).toBeVisible()
  await expect(row).toHaveCount(0)
}

test('pagination reports a failed page, retries the same cursor and never duplicates rows', async ({ page }) => {
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
    const copy = documentsCopy.en
    const documents = page.getByRole('list', { name: copy.title, exact: true })
    await expect(documents.getByRole('listitem')).toHaveCount(50)
    await page.getByRole('button', { name: 'Load more', exact: true }).click()
    const alert = page.getByRole('alert')
    await expect(alert).toContainText(copy.moreError)
    await expect(alert).toBeInViewport()
    await expect(alert).toBeFocused()
    await expect(documents.getByRole('listitem')).toHaveCount(50)

    await alert.getByRole('button', { name: copy.retry, exact: true }).click()
    await expect(alert).toHaveCount(0)
    await expect(documents.getByRole('listitem')).toHaveCount(51)
    await expect(documents.getByRole('link', { name: next.title, exact: true })).toBeVisible()
    expect(cursors).toEqual([
      null,
      'boundary-next',
      'boundary-next',
    ])
    await expect(page.getByRole('button', { name: 'Load more', exact: true })).toHaveCount(0)
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

test('a confirmed restore survives a failed refresh and keeps the surface usable', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  const prefix = `Restore boundary ${crypto.randomUUID()}`
  const target = documentEntry({ title: `${prefix} target`, version: 2 })
  const other = documentEntry({ title: `${prefix} other` })
  const { api, held, captured } = await serveTrashRestore(page, { target, other, refreshed: [other] })
  try {
    await mountSurface(page, { surface: 'documents' })
    const copy = documentsCopy.en
    // Restoring is a mutation of the listed row, never a navigation away.
    const mounted = page.url()
    const { row, other: otherRow, restore } = await trashRows(page, copy, {
      target: target.title,
      other: other.title,
    })
    const sibling = otherRow.getByRole('button', { name: copy.restore, exact: true })
    const search = page.getByRole('searchbox', { name: copy.search, exact: true })
    await expectRestoreBounds(page, restore)
    await page.screenshot({ path: info.outputPath('trash-before-restore-en.png') })

    await search.fill('Unsubmitted search text')
    await restore.click()
    await captured.promise
    await expect(row).toHaveCount(0)
    await expect(sibling).toBeDisabled()
    await expect(search).toHaveValue('Unsubmitted search text')
    held.open()

    await expectRestoreNotices(page, copy, row, sibling)
    const writes = api.calls.filter(call => call.method === 'POST')
    expect(writes).toHaveLength(1)
    expect(writes[0]?.json).toEqual({ expectedVersion: target.version })

    await expectRestoreBounds(page, sibling)
    await page.setViewportSize({ width: 800, height: 1000 })
    await expectRestoreBounds(page, sibling)
    await page.setViewportSize({ width: 1440, height: 1000 })
    await horizontalBounds(page, page.getByRole('alert'))
    await page.screenshot({ path: info.outputPath('trash-refresh-failed-en.png') })

    await expectRetryRecovers(page, copy, row, otherRow)
    expect(page.url()).toBe(mounted)
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
    await expect(alert).toContainText(copy.loadError)
    await expect(page.getByRole('status').filter({ hasText: copy.restored })).toBeVisible()
    await horizontalBounds(page, alert)
    await page.screenshot({ path: info.outputPath('trash-refresh-failed-zh.png') })
    await api.expectServed()
  }
  finally {
    held.open()
    await api.dispose()
  }
})

test('a lost restore response retries with the same idempotency key', async ({ page }) => {
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
    const { row, restore } = await trashRows(page, copy, {
      target: target.title,
      other: other.title,
    })
    await restore.click()
    await expect(page.getByRole('alert')).toContainText(copy.restoreUnknown)
    await page.getByRole('button', { name: copy.retry, exact: true }).click()
    await expect(row).toHaveCount(0)
    await expect(page.getByRole('status').filter({ hasText: copy.restored })).toBeFocused()

    expectRetriedWrite(api, {
      route: 'POST /api/admin/documents/:id/restore-deleted',
      path: `/api/admin/documents/${target.documentId}/restore-deleted`,
      body: { expectedVersion: target.version },
    })
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

test('a restore conflict refreshes the list before another attempt', async ({ page }) => {
  const target = documentEntry({ title: 'Conflict target', version: 3 })
  const other = documentEntry({ title: 'Conflict other' })
  let restores = 0
  let committed = false
  const api = await serveApi(page, {
    'GET /api/admin/documents': () => ({ body: documentsPage(committed ? [other] : [target, other]) }),
    'POST /api/admin/documents/:id/restore-deleted': () => {
      restores += 1
      if (restores === 1) {
        return failure(409, 'EDIT_CONFLICT')
      }
      committed = true
      return { body: acknowledgementFor(target, { version: target.version + 1 }) }
    },
  })
  try {
    await mountSurface(page, { surface: 'documents' })
    const copy = documentsCopy.en
    const { row, restore } = await trashRows(page, copy, {
      target: target.title,
      other: other.title,
    })
    await restore.click()
    const alert = page.getByRole('alert')
    await expect(alert).toContainText(copy.conflict)
    // A conflict is answered by refreshing the list, not by repeating the write.
    await alert.getByRole('button', { name: copy.refresh, exact: true }).click()
    await expect(alert).toHaveCount(0)
    expect(restores).toBe(1)
    await restore.click()
    await expect(row).toHaveCount(0)
    expect(restores).toBe(2)
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})
