import type { Locator, Page } from '@playwright/test'
import type { ApiHandler, ApiService } from '../support/http-fixtures'
import type { OpenDocument } from '@/contracts/documents'
import { assertAccessible } from '~/tests/support/browser/accessibility'
import {
  calloutBlock,
  EDITOR_WORKSPACE_DOCUMENT_ID,
  editorWorkspaceDocument,
  editorWorkspaceSaveAck,
  emptyFileBlock,
  mermaidBlock,
  paragraphBlocks,
  registerEmptyMedia,
  tableBlock,
} from '../support/editor-workspace-fixtures'
import { editorReady, mountEditorWorkspace, openPublicationTab } from '../support/editor-workspace-ui'
import { failure } from '../support/http-fixtures'
import { expect, test } from '../support/test'

for (const width of [1440, 320]) {
  test(`publication locates nested media and its diagram editing control at ${width}px`, async ({ page }) => {
    const fileId = crypto.randomUUID()
    const diagramId = crypto.randomUUID()
    const document = editorWorkspaceDocument('Nested locate target', (body) => {
      body.blocks = paragraphBlocks(30)
      const file = emptyFileBlock(fileId)
      const diagram = mermaidBlock('Unsupported diagram')
      diagram.id = diagramId
      body.blocks.push(calloutBlock([file]), diagram)
      registerEmptyMedia(body, fileId)
    })
    const api = await mountEditorWorkspace(page, {
      document,
      width,
      writes: {
        'PUT /api/admin/documents/:id/revisions': editorWorkspaceSaveAck,
        // The refusal itself is the Worker's own rule (proved by its unit and
        // retained E2E cases); this reply declares what the locator must handle.
        'POST /api/admin/documents/:id/publish': () => ({
          status: 422,
          body: { code: 'PUBLICATION_INVALID', issues: ['mediaSource', 'diagram'] },
        }),
      },
    })
    try {
      await editorReady(page)
      await page.getByRole('button', { name: 'Publish', exact: true }).click()
      const notice = page.getByRole('region', { name: 'Publication checks failed', exact: true })
      await notice.getByRole('button', { name: /^Locate issue: Select a file/ }).click()
      const file = page.locator(`[data-node-type="blockContainer"][data-id="${fileId}"]`)
      await expect(file.locator('.ProseMirror-selectednode')).toHaveCount(1)
      await expect(file).toBeInViewport()
      await expect(page.getByRole('textbox', { name: 'Document body', exact: true })).toBeFocused()
      await page.getByRole('button', { name: 'Edit media', exact: true }).click()
      const media = page.getByRole('dialog', { name: 'Add media', exact: true })
      await expect(media).toBeVisible()
      await media.getByRole('tab', { name: 'Upload files', exact: true }).click()
      await expect(media.locator('input[type="file"]')).toHaveCount(1)
      await media.getByRole('button', { name: 'Close', exact: true }).click()
      await expect(media).toHaveCount(0)
      await notice.getByRole('button', { name: /^Locate issue: Fix empty/ }).click()
      const edit = page.locator(`[data-id="${diagramId}"]`).getByRole('button', { name: 'Edit diagram', exact: true })
      await expect(edit).toBeFocused()
      await expect(edit).toBeInViewport()
      await edit.press('Enter')
      await expectSourceCursor(page)
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}

async function expectSourceCursor(page: Page): Promise<void> {
  const source = page.getByRole('textbox', { name: 'Diagram source', exact: true })
  await expect(source).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Document body', exact: true })).toBeFocused()
  expect(await source.evaluate(element => element.contains(window.getSelection()?.anchorNode ?? null))).toBe(true)
}

// A refusal the browser cannot see: the Worker reports a reason for content it
// owns, and the notice must show it, take focus and offer no broken locator.
test('server-only publication reasons remain visible without a matching local block', async ({ page }) => {
  const document = editorWorkspaceDocument('Server-only reason', (body) => {
    body.blocks = paragraphBlocks(1)
  })
  const api = await mountEditorWorkspace(page, {
    document,
    writes: {
      'POST /api/admin/documents/:id/publish': () => ({
        status: 422,
        body: { code: 'PUBLICATION_INVALID', issues: ['image'] },
      }),
    },
  })
  try {
    await editorReady(page)
    await page.getByRole('button', { name: 'Publish', exact: true }).click()
    const notice = page.getByRole('region', { name: 'Publication checks failed', exact: true })
    await expect(notice.getByRole('listitem')).toHaveText([
      'Add image alternative text or mark the image as decorative.',
    ])
    await expect(notice.getByRole('button')).toHaveCount(0)
    await expect(notice).toBeFocused()
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

for (const width of [1440, 320]) {
  test(`publication summary cycles current table order and returns focus at ${width}px`, async ({ page }, info) => {
    const { api, open, first, second } = await tableWorkspace(page, width)
    try {
      const summary = page.locator('.publication-summary')
      await openPublicationTab(page, 'en')
      await locateTable(summary, 2).click()
      await expectCaptionTarget(page, first)
      if (width === 320) {
        await expect(page.getByRole('dialog', { name: 'Document settings', exact: true })).toHaveCount(0)
      }
      await openPublicationTab(page, 'en')
      await locateTable(summary, 2).click()
      await expectCaptionTarget(page, second)
      // Move the second table above the first. The incremental node index keeps
      // its old insertion order, so the next lookup must use the actual document.
      await page.getByRole('button', { name: 'Move block up', exact: true }).click()
      await savedStatus(page)
      await openPublicationTab(page, 'en')
      await locateTable(summary, 2).click()
      await expectCaptionTarget(page, first)
      await openPublicationTab(page, 'en')
      await assertAccessible(page, info, { label: `publication-locate-${width}` })
      await page.screenshot({ path: info.outputPath(`publication-locate-${width}.png`) })
      expect(open.documentId).toBe(EDITOR_WORKSPACE_DOCUMENT_ID)
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}

for (const width of [1440, 320]) {
  test(`publication target counts follow block deletion and undo at ${width}px`, async ({ page }) => {
    const { api, first, second } = await tableWorkspace(page, width)
    try {
      const notice = await rejectedPublication(page)
      await locateTable(notice, 2).click()
      await expectCaptionTarget(page, first)
      const table = page.locator(`[data-id="${first}"] table`)
      await table.evaluate(element => element.scrollIntoView({ block: 'center' }))
      await table.getByText('First cell', { exact: true }).hover()
      const position = await page.evaluate(() => scrollY)
      await page.getByRole('button', { name: 'Open block menu', exact: true }).click()
      await expect(page.locator('.editor-block-action-list')).toBeVisible()
      if (width === 1440) {
        expect(await page.evaluate(() => scrollY)).toBeCloseTo(position, 0)
      }
      await page.locator('.editor-block-action-list').getByRole('button', { name: 'Delete', exact: true }).click()
      await expect(table).toHaveCount(0)
      await expect(locateTable(notice, 1)).toBeVisible()
      await locateTable(notice, 1).click()
      await expectCaptionTarget(page, second)
      await page.getByRole('button', { name: 'Undo', exact: true }).click()
      await expect(table).toHaveCount(1)
      await expect(locateTable(notice, 2)).toBeVisible()
      await page.locator(`[data-id="${second}"] table`).getByText('First cell', { exact: true }).click()
      await locateTable(notice, 2).click()
      await expectCaptionTarget(page, first)
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}

for (const width of [1440, 320]) {
  test(`failed autosave retains publication reasons and typing focus at ${width}px`, async ({ page }) => {
    let saveFailed = false
    const { api } = await tableWorkspace(page, width, {
      'PUT /api/admin/documents/:id/revisions': (call) => {
        if (!saveFailed) {
          saveFailed = true
          return failure(503, 'CONNECTION_FAILED')
        }
        return editorWorkspaceSaveAck(call)
      },
    })
    try {
      const notice = await rejectedPublication(page)
      await expect(locateTable(notice, 2)).toBeVisible()
      const title = page.getByRole('textbox', { name: 'Title', exact: true })
      await title.fill('Typing through a temporary save failure')
      const saveError = page.getByRole('region', { name: 'Could not complete this action', exact: true })
      await expect(saveError).toContainText('Connection failed.')
      await expect(locateTable(notice, 2)).toBeVisible()
      await expect(title).toBeFocused()
      await savedStatus(page)
      await expect(saveError).toHaveCount(0)
      await expect(locateTable(notice, 2)).toBeVisible()
      await expect(title).toBeFocused()
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}

/** Two tables with no captions: the reasons the publication refusal carries. */
async function tableWorkspace(
  page: Page,
  width: number,
  writes: Readonly<Record<string, ApiHandler>> = {},
): Promise<{ api: ApiService, open: OpenDocument, first: string, second: string }> {
  const table = tableBlock()
  const other = tableBlock()
  const open = editorWorkspaceDocument('Table locate target', (body) => {
    body.blocks = [
      ...paragraphBlocks(36),
      table,
      other,
    ]
  })
  const api = await mountEditorWorkspace(page, {
    document: open,
    width,
    writes: {
      'PUT /api/admin/documents/:id/revisions': editorWorkspaceSaveAck,
      'POST /api/admin/documents/:id/publish': () => ({
        status: 422,
        body: { code: 'PUBLICATION_INVALID', issues: ['table'] },
      }),
      ...writes,
    },
  })
  await editorReady(page)
  return { api, open, first: table.id, second: other.id }
}

/** Publishes an uncaptioned table document and returns the refusal notice. */
async function rejectedPublication(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  const notice = page.getByRole('region', { name: 'Publication checks failed', exact: true })
  await expect(notice).toBeVisible()
  return notice
}

function locateTable(container: Locator, count: number): Locator {
  return container.getByRole('button', { name: new RegExp(`(?:Add a caption|请为各表格).*(?:\\(${count}\\)|${count} 处)`) })
}

function captionButton(page: Page, id: string): Locator {
  return page.locator(`[data-id="${id}"] .editor-table-caption button`)
}

async function expectCaptionTarget(page: Page, id: string): Promise<void> {
  await expect(captionButton(page, id)).toBeFocused()
  await expect(captionButton(page, id)).toBeInViewport()
  const top = await captionButton(page, id).evaluate(element => element.getBoundingClientRect().top)
  const toolbarBottom = await page.getByRole('toolbar').evaluate(element => element.getBoundingClientRect().bottom)
  expect(top).toBeGreaterThanOrEqual(toolbarBottom)
}

async function savedStatus(page: Page): Promise<void> {
  await expect(page.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible({ timeout: 15000 })
}
