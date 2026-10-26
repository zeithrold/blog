import type { Locator, Page } from '@playwright/test'
import type { ApiCall, ApiService } from './http-fixtures'
import type { Document } from '@/content/document'
import { expect } from '@playwright/test'
import { z } from 'zod'
import {
  EDITOR_WORKSPACE_DOCUMENT_ID,
  editorWorkspaceApi,
  editorWorkspaceDocument,
  editorWorkspaceSaveAck,
  paragraphBlock,
  paragraphBlocks,
  tableBlock,
} from './editor-workspace-fixtures'
import { serveApi } from './http-fixtures'
import { mountSurface } from './mount'

export type OverlayWorkspace = {
  readonly api: ApiService
  readonly body: Locator
}

/** The table cell a menu case reveals its block controls from. */
const firstCell = 'First cell'

async function mountOverlay(page: Page, options: {
  readonly title: string
  readonly width: number
  readonly height: number
  readonly configure: (document: Document) => void
}): Promise<OverlayWorkspace> {
  const open = editorWorkspaceDocument(options.title, options.configure)
  const api = await serveApi(page, {
    ...editorWorkspaceApi(open),
    'PUT /api/admin/documents/:id/revisions': editorWorkspaceSaveAck,
  })
  await page.setViewportSize({ width: options.width, height: options.height })
  await mountSurface(page, {
    surface: 'editor-workspace',
    route: `/admin/documents/${EDITOR_WORKSPACE_DOCUMENT_ID}`,
  })
  const body = page.getByLabel('Document body', { exact: true })
  await expect(body).toBeVisible()
  // The entry names the document to open; this title only exists in the case's
  // document reply, so reading it proves the real session load ran.
  await expect(page.locator('.title-field input')).toHaveValue(options.title)
  return { api, body }
}

/**
 * Mounts the production editor entry on a table plus optional filler body, the
 * layout a block-menu case needs. Every save is answered by the shared ack; a
 * case asserts the packet the client sent, and storage stays with E2E.
 */
export async function openTableWorkspace(page: Page, options: {
  readonly title?: string
  readonly paragraphs?: number
  readonly height?: number
} = {}): Promise<OverlayWorkspace> {
  const title = options.title ?? 'Overlay menu'
  return await mountOverlay(page, {
    title,
    width: 1440,
    height: options.height ?? 1000,
    configure: (document) => {
      document.blocks = [
        tableBlock(),
        ...paragraphBlocks(options.paragraphs ?? 0),
      ]
    },
  })
}

/** Mounts the production editor on one paragraph, the body the colour menu acts on. */
export async function openSelectionWorkspace(
  page: Page,
  text = 'Selected phrase',
): Promise<OverlayWorkspace> {
  return await mountOverlay(page, {
    title: 'Overlay selection',
    width: 1440,
    height: 1000,
    configure: (document) => {
      document.blocks = [
        paragraphBlock(text),
      ]
    },
  })
}

/** The fixture table: the block the side controls belong to. */
export function overlayTable(page: Page): Locator {
  return page.getByLabel('Document body', { exact: true }).locator('table')
}

/** The side control that opens the desktop block menu for the hovered block. */
export function blockMenuTrigger(page: Page): Locator {
  return page.getByRole('button', { name: 'Open block menu', exact: true })
}

/** The desktop actions popover, the menu these cases keep open or closed. */
export function desktopMenu(page: Page): Locator {
  return page.locator('.editor-desktop-block-actions')
}

/**
 * Reveals the table's side controls and opens the block menu, returning it once
 * it is painted. The pointer lands on the existing cell, so no scroll of its
 * own can dismiss the controls the menu was opened from.
 */
export async function openBlockMenu(page: Page): Promise<Locator> {
  await overlayTable(page).getByText(firstCell, { exact: true }).hover()
  await blockMenuTrigger(page).click()
  const menu = desktopMenu(page)
  await expect(menu).toHaveCSS('opacity', '1')
  return menu
}

const packetSchema = z.object({
  document: z.object({
    meta: z.object({ title: z.string(), slug: z.string() }),
  }),
})

type PacketMeta = z.infer<typeof packetSchema>['document']['meta']

/** The document meta the last revision packet carried. */
export function packetMeta(api: ApiService): PacketMeta | undefined {
  const writes: ApiCall[] = api.calls.filter(call => call.method === 'PUT')
  const parsed = packetSchema.safeParse(writes.at(-1)?.json)
  return parsed.success ? parsed.data.document.meta : undefined
}

/** Waits for a revision packet whose meta carries these fields. */
export async function expectPacketMeta(
  api: ApiService,
  expected: Partial<PacketMeta>,
): Promise<void> {
  await expect.poll(() => packetMeta(api), { timeout: 15000 }).toMatchObject(expected)
}
