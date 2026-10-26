import type { Locator, Page } from '@playwright/test'
import type { ComponentLocale } from '../src/contract'
import type { ApiCall, ApiService } from './http-fixtures'
import { expect } from '@playwright/test'
import { z } from 'zod'
import {
  EDITOR_WORKSPACE_DOCUMENT_ID,
  editorWorkspaceApi,
  editorWorkspaceDocument,
  editorWorkspaceSaveAck,
  paragraphBlock,
} from './editor-workspace-fixtures'
import { serveApi } from './http-fixtures'
import { mountSurface } from './mount'

export const linkPrefix = 'Before '
export const linkSelected = 'Selected link'
export const linkSuffix = ' untouched suffix'
export const linkUrl = 'https://example.com/keyboard-link?from=editor#selection'

export const formatSelected = 'Selected phrase'
export const formatSuffix = ' untouched suffix'

/** The production labels the formatting and link controls answer to, per locale. */
export const formattingCopy = {
  en: {
    body: 'Document body',
    toolbar: 'Formatting',
    more: 'More formatting options',
    drawer: 'Formatting options',
    dialog: 'Create link',
    url: 'Edit URL',
    save: 'Save',
    cancel: 'Cancel',
    undo: 'Undo',
    invalid: 'Enter a valid',
  },
  zh: {
    body: '正文',
    toolbar: '文字格式',
    more: '更多格式选项',
    drawer: '格式选项',
    dialog: '添加链接',
    url: '编辑链接地址',
    save: '保存',
    cancel: '取消',
    undo: '撤销',
    invalid: '请输入有效',
  },
} as const

export type FormattingWorkspace = { readonly api: ApiService, readonly body: Locator }

/**
 * Mounts the production editor entry on one paragraph in the requested locale, so a case can
 * select a range and drive the real formatting toolbar or link entry in that language. The save
 * is answered by the shared ack and a case asserts the packet the client sent.
 */
export async function openFormattingWorkspace(
  page: Page,
  text: string,
  locale: ComponentLocale = 'en',
): Promise<FormattingWorkspace> {
  const open = editorWorkspaceDocument('Formatting interaction', (document) => {
    document.blocks = [
      paragraphBlock(text),
    ]
  })
  const api = await serveApi(page, {
    ...editorWorkspaceApi(open),
    'PUT /api/admin/documents/:id/revisions': editorWorkspaceSaveAck,
  })
  await mountSurface(page, {
    surface: 'editor-workspace',
    locale,
    route: `/admin/documents/${EDITOR_WORKSPACE_DOCUMENT_ID}`,
  })
  const body = page.getByLabel(formattingCopy[locale].body, { exact: true })
  await expect(body).toBeVisible()
  return { api, body }
}

/** Selects the text range natively, the way a pointer drag or Shift+Arrow would leave it. */
export async function selectRange(
  page: Page,
  body: Locator,
  range: { start: number, end: number },
  expected: string,
): Promise<void> {
  await body.focus()
  await body.evaluate(async (element, offsets) => {
    await document.fonts.ready
    const inline = element.querySelector('.bn-inline-content')
    const node = inline === null ? null : document.createTreeWalker(inline, NodeFilter.SHOW_TEXT).nextNode()
    if (node === null) {
      throw new Error('The formatting fixture has no selectable text')
    }
    window.getSelection()?.setBaseAndExtent(node, offsets.start, node, offsets.end)
    document.dispatchEvent(new Event('selectionchange'))
  }, range)
  await expect.poll(async () => await page.evaluate(() => window.getSelection()?.toString()))
    .toBe(expected)
}

type PacketBlock = { id: string, type: string, props?: unknown, content?: unknown }

const packetSchema = z.object({
  document: z.object({
    blocks: z.array(z.object({
      id: z.string(),
      type: z.string(),
      props: z.record(z.string(), z.unknown()).optional(),
      content: z.unknown().optional(),
    })),
  }),
})

function packetBlocks(api: ApiService): PacketBlock[] | undefined {
  const writes: ApiCall[] = api.calls.filter(call => call.method === 'PUT')
  const parsed = packetSchema.safeParse(writes.at(-1)?.json)
  return parsed.success ? parsed.data.document.blocks : undefined
}

/** The first block's inline content from the last revision packet the client sent. */
export function lastPacketContent(api: ApiService): unknown {
  return packetBlocks(api)?.[0]?.content
}

/** Waits for a packet whose inline content equals the expected shape. */
export async function expectPacketContent(api: ApiService, expected: unknown): Promise<void> {
  await expect.poll(() => lastPacketContent(api), { timeout: 15000 }).toEqual(expected)
}

/** Revision writes only, so a case can prove nothing was saved. */
export function revisionWrites(api: ApiService): ApiCall[] {
  return api.calls.filter(call => call.method === 'PUT')
}

/**
 * Opens the link entry the way the platform shortcut does. ControlOrMeta keeps the primary
 * modifier of the running platform; the product accepts both Control and Meta.
 */
export async function openKeyboardLink(
  page: Page,
  locale: ComponentLocale = 'en',
): Promise<Locator> {
  const copy = formattingCopy[locale]
  await page.keyboard.press('ControlOrMeta+k')
  const url = page.getByRole('textbox', { name: copy.url, exact: true })
  await expect(url).toBeVisible()
  const dialog = page.getByRole('dialog', { name: copy.dialog, exact: true })
  if (await dialog.count() > 0) {
    await expect.poll(async () => await dialog.evaluate(element =>
      element.getAnimations({ subtree: true }).every(animation =>
        animation.playState === 'finished' || animation.playState === 'idle'))).toBe(true)
  }
  return url
}

/** Opens the link entry through the shortcut or the toolbar/drawer control, as an author would. */
export async function openLinkEntry(
  page: Page,
  entry: 'keyboard' | 'toolbar',
  width: number,
  locale: ComponentLocale = 'en',
): Promise<Locator> {
  const copy = formattingCopy[locale]
  if (entry === 'keyboard') {
    return await openKeyboardLink(page, locale)
  }
  if (width <= 700) {
    await page.getByRole('button', { name: copy.more, exact: true }).click()
    await page.getByRole('dialog', { name: copy.drawer, exact: true })
      .getByRole('button', { name: copy.dialog, exact: true })
      .click()
    await expect(page.locator('.formatting-options-drawer')).toHaveCount(0)
  }
  else {
    await page.getByRole('toolbar', { name: copy.toolbar, exact: true })
      .getByRole('button', { name: copy.dialog, exact: true })
      .click()
  }
  const dialog = page.getByRole('dialog', { name: copy.dialog, exact: true })
  await expect(dialog).toBeVisible()
  const url = dialog.getByRole('textbox', { name: copy.url, exact: true })
  await expect(url).toBeFocused()
  return url
}
