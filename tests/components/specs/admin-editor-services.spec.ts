import type { ApiService } from '../support/http-fixtures'
import { validateDocument } from '@/content/validation'
import { saveSchema } from '@/contracts/documents'
import { chooseTimezone, publicationTime, verifiedTime } from '~/tests/browser/publication/schedule-helpers'
import { saved } from '~/tests/support/browser/document'
import { settingsTab } from '~/tests/support/browser/settings'
import { catalogEntry, catalogPage } from '../support/domain-fixtures'
import { openWorkspace, serveWorkspace } from '../support/editor-workspace-case'
import { editorWorkspaceDocument, editorWorkspaceWrites } from '../support/editor-workspace-fixtures'
import { apiKey, defer } from '../support/http-fixtures'
import { expect, test } from '../support/test'

/** The document the last acknowledged draft save would have stored. */
function savedDocument(api: ApiService): unknown {
  const saves = editorWorkspaceWrites(api.calls).filter(call =>
    apiKey(call.method, call.path) === 'PUT /api/admin/documents/:id/revisions')
  const last = saves.at(-1)
  if (last === undefined) {
    throw new Error('The edit must reach the save boundary before it can be read back')
  }
  return saveSchema.parse(last.json).document
}

// The paste pipeline is the client's sanitizer plus the native editor: the case
// reads the document the save boundary would store, so no Worker is involved.
test('bounded HTML paste preserves supported formatting and removes active content', async ({ page }) => {
  const api = await serveWorkspace(page, editorWorkspaceDocument('Clipboard sanitizing'))
  try {
    await openWorkspace(page, { title: 'Clipboard sanitizing', width: 1440, height: 1000 })
    const body = page.getByLabel('Document body', { exact: true })
    await body.click()
    await body.evaluate((element) => {
      const data = new DataTransfer()
      data.setData(
        'text/html',
        '<h2>Clipboard heading</h2><p><strong>Bold clip</strong>'
        + '<a href="javascript:alert(1)">Unsafe link</a><script>alert(1)</script></p>',
      )
      data.setData('text/plain', 'Clipboard heading Bold clip Unsafe link')
      element.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
      )
    })
    await expect(body).toContainText('Clipboard heading')
    await expect(body.locator('strong')).toContainText('Bold clip')
    await expect(body.locator('a[href^="javascript:"]')).toHaveCount(0)
    await expect(body.locator('script')).toHaveCount(0)
    await saved(page)
    const document = validateDocument(savedDocument(api))
    expect(document.blocks.some(block => block.type === 'heading')).toBe(true)
    expect(new Set(document.blocks.map(block => block.id)).size).toBe(document.blocks.length)
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

/** The scheduling boundary: one held submit, then a pending job the list reports. */
function schedulingBoundary(state: {
  pending: boolean
  started: ReturnType<typeof defer>
  release: ReturnType<typeof defer>
}) {
  const scheduleId = '9b2f0c4a-1d3e-4f5a-8b6c-7d8e9f0a1b2c'
  const runAt = Date.UTC(2030, 0, 1, 10, 0)
  return {
    'GET /api/admin/documents/:id/schedule': () => ({
      body: {
        items: state.pending
          ? [
              {
                id: scheduleId,
                revisionId: editorWorkspaceDocument().headRevisionId,
                state: 'pending',
                runAt,
                localTime: '2030-01-01T10:00',
                timezone: 'UTC',
                utcOffset: 0,
                attempts: 0,
                nextAttemptAt: runAt,
                errorCode: null,
                createdAt: runAt,
              },
            ]
          : [],
      },
    }),
    // An unambiguous local time: the select adds its own empty choice, so one
    // verified offset is what the author sees beside it.
    'GET /api/admin/schedule-time': () => ({
      body: {
        choices: [
          { runAt, utcOffset: 0 },
        ],
      },
    }),
    'POST /api/admin/documents/:id/schedule': async () => {
      state.started.open()
      await state.release.promise
      state.pending = true
      return {
        body: {
          documentId: editorWorkspaceDocument().documentId,
          version: 1,
          headRevisionId: editorWorkspaceDocument().headRevisionId,
          liveRevisionId: null,
          liveGeneration: 0,
          scheduleId,
          state: 'pending',
        },
      }
    },
  }
}

// Scheduling holds the whole editing surface until the boundary answers: the
// held reply is the client's pending state, not a route the browser owns.
test('scheduling locks publication and keeps the editor mounted while the request is pending', async ({ page }) => {
  const state = { pending: false, started: defer(), release: defer() }
  const api = await serveWorkspace(
    page,
    editorWorkspaceDocument('Scheduling lock'),
    schedulingBoundary(state),
  )
  try {
    await openWorkspace(page, { title: 'Scheduling lock', width: 1440, height: 1000 })
    const body = page.getByLabel('Document body', { exact: true })
    const editor = await body.elementHandle()
    await settingsTab(page, 'Publication')
    await page.getByText('Scheduled publication', { exact: true }).click()
    await publicationTime(page, new Date(Date.now() + 3600000).toISOString().slice(0, 16))
    await chooseTimezone(page, 'UTC')
    await page.getByRole('button', { name: 'Check timezone and DST', exact: true }).click()
    await verifiedTime(page)
    await page.getByRole('button', { name: 'Schedule saved draft', exact: true }).click()
    await state.started.promise
    await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled()
    await expect(body).toHaveAttribute('contenteditable', 'false')
    state.release.open()
    await expect(page.getByRole('button', { name: 'Cancel schedule', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeEnabled()
    await expect(body).toHaveAttribute('contenteditable', 'true')
    expect(await editor.evaluate(element => element.isConnected)).toBe(true)
    await saved(page)
    await api.expectServed()
  }
  finally {
    state.release.open()
    await api.dispose()
  }
})

// Choosing a catalog entry is a local form decision, but it has to reach the save
// packet: the case reads the document the boundary would store.
test('catalog snapshots reach the save packet from the editor', async ({ page }) => {
  const tag = catalogEntry({ kind: 'tag', name: 'Snapshot tag', slug: 'snapshot-tag' })
  const api = await serveWorkspace(page, editorWorkspaceDocument('Catalog snapshot'), {
    'GET /api/admin/catalog/tag': () => ({ body: catalogPage([tag]) }),
  })
  try {
    await openWorkspace(page, { title: 'Catalog snapshot', width: 1440, height: 1000 })
    await page.getByText('Tags and series', { exact: true }).click()
    const tags = page.getByRole('region', { name: 'Tags and series', exact: true })
    await tags.getByRole('combobox', { name: 'Tags', exact: true }).click()
    await page.getByRole('combobox', { name: 'Search tags', exact: true }).fill(tag.name)
    await page.getByRole('option', { name: tag.name, exact: true }).click()
    await page.keyboard.press('Escape')
    await saved(page)
    const document = validateDocument(savedDocument(api))
    expect(document.meta.tags[0]?.id).toBe(tag.id)
    expect(document.meta.tags[0]?.label).toBe(tag.name)
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})
