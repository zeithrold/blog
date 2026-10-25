import type { Locator, Page } from '@playwright/test'
import type { ApiCall, ApiHandler, ApiService } from './http-fixtures'
import { expect } from '@playwright/test'
import { z } from 'zod'
import {
  codeBlock,
  EDITOR_WORKSPACE_DOCUMENT_ID,
  editorWorkspaceApi,
  editorWorkspaceDocument,
  editorWorkspaceSaveAck,
} from './editor-workspace-fixtures'
import { serveApi } from './http-fixtures'
import { mountSurface } from './mount'

/** The code source every case edits: two lines, so the block renders more than one token line. */
export const codeSource = 'const total = 1\nconsole.log(total)'

/** The reads the workspace performs plus the revision write the draft coordinator sends. */
export function editorCodeApi(open: ReturnType<typeof editorWorkspaceDocument>):
Record<string, ApiHandler> {
  return {
    ...editorWorkspaceApi(open),
    'PUT /api/admin/documents/:id/revisions': editorWorkspaceSaveAck,
  }
}

export type CodeWorkspace = {
  readonly api: ApiService
  readonly body: Locator
  readonly block: Locator
  readonly code: Locator
  readonly selector: Locator
}

/** Mounts the production editor entry on a document whose first block is the code block. */
export async function openCodeWorkspace(
  page: Page,
  options: { language?: string, source?: string } = {},
): Promise<CodeWorkspace> {
  const open = editorWorkspaceDocument('Native code language', (document) => {
    document.blocks.unshift(codeBlock(options.source ?? codeSource, options.language ?? 'text'))
  })
  const api = await serveApi(page, editorCodeApi(open))
  await mountSurface(page, {
    surface: 'editor-workspace',
    route: `/admin/documents/${EDITOR_WORKSPACE_DOCUMENT_ID}`,
  })
  const body = page.getByLabel('Document body', { exact: true })
  const block = body.locator('[data-content-type="codeBlock"]')
  await expect(body).toBeVisible()
  await expect(block).toBeVisible()
  return {
    api,
    body,
    block,
    code: block.locator('pre code'),
    selector: block.getByRole('combobox', { name: 'Code language', exact: true }),
  }
}

/** Number of distinct colours the highlighter painted, once it has painted any. */
export async function coloredTokens(code: Locator): Promise<void> {
  await expect.poll(async () => new Set(await code.locator('.shiki').evaluateAll(elements =>
    elements.map(element => getComputedStyle(element).color))).size).toBeGreaterThan(2)
}

/** The code block's stored language and text from the last revision packet the editor sent. */
const packetSchema = z.object({
  document: z.object({
    blocks: z.array(z.object({
      type: z.string(),
      props: z.record(z.string(), z.unknown()).optional(),
      content: z.array(z.object({ text: z.string().optional() })).optional(),
    })),
  }),
})

function storedCode(json: unknown): { language: unknown, text: string | undefined } | undefined {
  const parsed = packetSchema.safeParse(json)
  if (!parsed.success) {
    return undefined
  }
  const block = parsed.data.document.blocks.find(item => item.type === 'codeBlock')
  if (block === undefined) {
    return undefined
  }
  return {
    language: block.props?.language,
    text: block.content?.map(part => part.text ?? '').join(''),
  }
}

/**
 * Asserts what the client handed to the API for the code block. The save is answered by the
 * case's own acknowledgement, so this reads the request and never claims stored state.
 */
export async function expectSavedCode(
  api: ApiService,
  expected: { language: string, text?: string },
): Promise<void> {
  await expect.poll(() => {
    const writes: ApiCall[] = api.calls.filter(call => call.method === 'PUT')
    const stored = storedCode(writes.at(-1)?.json)
    if (stored === undefined || stored.language !== expected.language) {
      return undefined
    }
    return stored.text
  }, { timeout: 15000 }).toBe(expected.text ?? codeSource)
}
