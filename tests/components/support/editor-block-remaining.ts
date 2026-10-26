import type { Locator, Page } from '@playwright/test'
import type { ApiService } from './http-fixtures'
import type { Document } from '@/content/document'
import { expect } from '@playwright/test'
import { blockActions, labels } from '~/tests/browser/editor/blocks/block-action-helpers'
import { bounds } from '~/tests/browser/editor/tables/table-overlay-helpers'
import { withinViewport } from '~/tests/support/browser/layout'
import { editorWorkspaceDocument, editorWorkspaceSaveAck } from './editor-workspace-fixtures'
import { editorReady, mountEditorWorkspace } from './editor-workspace-ui'
import { editorWorkspaceCopy } from './expected-copy'

export type BlocksLocale = 'en' | 'zh'

export type BlockActionsWorkspace = { readonly api: ApiService, readonly body: Locator }

/**
 * Mounts the production editor entry on a saved block body at one viewport and
 * locale. The entry runs its own session and document load against the shared
 * workspace replies, and every revision write is answered by the shared
 * acknowledgement, so a case asserts the packet the client sent rather than
 * claiming the Worker stored it.
 */
export async function openBlockActions(
  page: Page,
  body: Document,
  options: {
    width?: number
    height?: number
    locale?: BlocksLocale
    mode?: 'light' | 'dark'
  } = {},
): Promise<BlockActionsWorkspace> {
  const locale = options.locale ?? 'en'
  const width = options.width ?? 1440
  const open = editorWorkspaceDocument('Native block actions', (document) => {
    document.blocks = structuredClone(body.blocks)
    document.tableAccessibility = structuredClone(body.tableAccessibility)
  })
  const api = await mountEditorWorkspace(page, {
    document: open,
    width,
    locale,
    mode: options.mode ?? 'light',
    writes: {
      'PUT /api/admin/documents/:id/revisions': editorWorkspaceSaveAck,
    },
  })
  if (options.height !== undefined) {
    await page.setViewportSize({ width, height: options.height })
  }
  await editorReady(page, locale)
  const element = page.getByLabel(editorWorkspaceCopy[locale].body, { exact: true })
  await expect(element).toBeVisible()
  return { api, body: element }
}

/**
 * Points at a table cell so its block controls appear, then opens the action
 * menu the same pointer path opens for any block. The table is only the fixture
 * that gives the menu its row and column actions.
 */
export async function openActionMenu(page: Page, locale: BlocksLocale): Promise<Locator> {
  const table = page.getByLabel(labels[locale].body, { exact: true }).locator('table')
  await table.evaluate(element => element.scrollIntoView({ block: 'center' }))
  await table.getByText('First cell', { exact: true }).hover()
  await page.getByRole('button', { name: labels[locale].menu, exact: true }).click()
  const menu = blockActions(page)
  await expect(menu).toBeVisible()
  await expect(menu).toHaveCSS('opacity', '1')
  await withinViewport(page, menu)
  return menu
}

/**
 * The four action rows stack in one column, share the list width and keep a
 * touch target on compact layouts and a dense row on desktop.
 */
export async function expectActionRows(list: Locator, mobile: boolean): Promise<void> {
  const listBox = await bounds(list)
  const buttons = list.getByRole('button')
  await expect(buttons).toHaveCount(4)
  let previousBottom = 0
  for (const button of await buttons.all()) {
    const box = await bounds(button)
    expect(box.y).toBeGreaterThanOrEqual(previousBottom)
    expect(box.x).toBeCloseTo(listBox.x, 0)
    expect(box.width).toBeCloseTo(listBox.width, 0)
    expect(box.height).toBeGreaterThanOrEqual(mobile ? 44 : 36)
    expect(await button.innerText()).not.toBe('')
    await expect(button.locator('svg').first()).toBeVisible()
    await expect(button).toHaveCSS('justify-content', 'flex-start')
    previousBottom = box.y + box.height
  }
}
