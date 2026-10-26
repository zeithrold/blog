import type { Locator, Page } from '@playwright/test'
import type { ApiService } from './http-fixtures'
import { expect } from '@playwright/test'
import { z } from 'zod'
import {
  EDITOR_WORKSPACE_DOCUMENT_ID,
  editorWorkspaceApi,
  editorWorkspaceDocument,
  editorWorkspaceSaveAck,
  paragraphBlocks,
} from './editor-workspace-fixtures'
import { serveApi } from './http-fixtures'
import { mountSurface } from './mount'

/** Filler paragraph text the block-action cases act on. */
export function blockText(index: number): string {
  return `Body paragraph ${String(index).padStart(2, '0')}`
}

export type BlocksWorkspace = { readonly api: ApiService, readonly body: Locator }

/**
 * Mounts the production editor entry on either a fixed set of filler paragraphs or the empty
 * first paragraph a slash command replaces. Saves are answered by the shared ack, so a case can
 * assert the packet the client sent.
 */
export async function openBlocksWorkspace(
  page: Page,
  blocks: 'empty' | number = 'empty',
): Promise<BlocksWorkspace> {
  const open = editorWorkspaceDocument('Native block actions', (document) => {
    if (blocks !== 'empty') {
      document.blocks = paragraphBlocks(blocks)
    }
  })
  const api = await serveApi(page, {
    ...editorWorkspaceApi(open),
    'PUT /api/admin/documents/:id/revisions': editorWorkspaceSaveAck,
  })
  await mountSurface(page, {
    surface: 'editor-workspace',
    route: `/admin/documents/${EDITOR_WORKSPACE_DOCUMENT_ID}`,
  })
  const body = page.getByLabel('Document body', { exact: true })
  await expect(body).toBeVisible()
  return { api, body }
}

export function paragraph(page: Page, index: number): Locator {
  return page.locator('.bn-block-content').filter({ hasText: blockText(index) })
}

/**
 * Reveals a block's side controls by pointing at it. Locator hover may scroll again, which
 * dismisses the controls, so the pointer is moved after the block is already in view.
 */
export async function reveal(page: Page, index: number): Promise<Locator> {
  const block = paragraph(page, index)
  await block.evaluate(async (element) => {
    element.scrollIntoView({ block: 'center', behavior: 'instant' })
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
  })
  const bounds = await block.boundingBox()
  if (bounds === null) {
    throw new Error('The block hover target is missing')
  }
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
  await expect(page.locator('.editor-side')).toBeVisible()
  return block
}

/** The actions surface: a drawer below the mobile breakpoint, a menu above it. */
export function blockActions(page: Page): Locator {
  return (page.viewportSize()?.width ?? 0) <= 700
    ? page.getByRole('dialog')
    : page.locator('.editor-desktop-block-actions')
}

/** Native drag from the block handle to the bottom of another block. */
export async function dragBlock(page: Page, handle: Locator, target: Locator): Promise<void> {
  await expect(handle).toBeVisible()
  await expect(target).toBeVisible()
  const sourceBounds = await handle.boundingBox()
  const targetBounds = await target.boundingBox()
  if (sourceBounds === null || targetBounds === null) {
    throw new Error('The native drag endpoints are missing')
  }
  const source = {
    x: sourceBounds.x + sourceBounds.width / 2,
    y: sourceBounds.y + sourceBounds.height / 2,
  }
  const destination = { x: targetBounds.x + 20, y: targetBounds.y + targetBounds.height - 1 }
  await page.mouse.move(source.x, source.y)
  await page.mouse.down()
  try {
    await page.mouse.move(source.x + 8, source.y, { steps: 4 })
    await expect(page.locator('.editor-desktop-block-actions')).toHaveCount(0)
    await page.mouse.move(destination.x, destination.y, { steps: 8 })
    // WebKit needs a second movement at the destination to deliver dragover.
    await page.mouse.move(destination.x, destination.y + 1)
    await expect(page.locator('.editor-desktop-block-actions')).toHaveCount(0)
  }
  finally {
    await page.mouse.up()
  }
  await expect(page.locator('.editor-desktop-block-actions')).toHaveCount(0)
}

const blockSchema = z.object({
  id: z.string(),
  type: z.string(),
  props: z.record(z.string(), z.unknown()).optional(),
  content: z.unknown().optional(),
})

type PacketBlock = { id: string, type: string, props?: unknown, content?: unknown }

const packetSchema = z.object({
  document: z.object({ blocks: z.array(blockSchema) }),
})

/** The blocks the last revision packet carried, reduced to what a block case asserts. */
export function packetBlocks(api: ApiService): PacketBlock[] | undefined {
  const writes = api.calls.filter(call => call.method === 'PUT')
  const parsed = packetSchema.safeParse(writes.at(-1)?.json)
  return parsed.success
    ? parsed.data.document.blocks.map(({ id, type, props, content }) => ({ id, type, props, content }))
    : undefined
}

/** Waits for a packet whose block projection equals the expected one. */
export async function expectPacketBlocks(api: ApiService, expected: unknown): Promise<void> {
  await expect.poll(
    () => packetBlocks(api)?.map(({ type, props, content }) => ({ type, props, content })),
    { timeout: 15000 },
  ).toEqual(expected)
}
