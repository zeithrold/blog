import type { Page } from '@playwright/test'
import type { ComponentLocale, ComponentMode } from '../src/contract'
import type { ApiHandler, ApiService } from './http-fixtures'
import type { OpenDocument } from '@/contracts/documents'
import { expect } from '@playwright/test'
import {
  EDITOR_WORKSPACE_DOCUMENT_ID,
  editorWorkspaceApi,
} from './editor-workspace-fixtures'
import { editorWorkspaceCopy } from './expected-copy'
import { serveApi } from './http-fixtures'
import { mountSurface } from './mount'

/**
 * Opens the editor workspace on its own document route, with this case's reads
 * and any declared writes as its only traffic. The route matters: the shell
 * reads the pathname to render the admin chrome the author sees.
 */
export async function mountEditorWorkspace(
  page: Page,
  options: {
    document: OpenDocument
    width?: number
    locale?: ComponentLocale
    mode?: ComponentMode
    /** Writes this case declares; nothing else may reach the surface's client. */
    writes?: Readonly<Record<string, ApiHandler>>
  },
): Promise<ApiService> {
  const api = await serveApi(page, {
    ...editorWorkspaceApi(options.document),
    ...options.writes,
  })
  await page.setViewportSize({ width: options.width ?? 1440, height: 900 })
  await mountSurface(page, {
    surface: 'editor-workspace',
    locale: options.locale ?? 'en',
    mode: options.mode ?? 'light',
    route: `/admin/documents/${EDITOR_WORKSPACE_DOCUMENT_ID}`,
  })
  return api
}

/** The entry finished loading: the real editor owns the loaded body. */
export async function editorReady(page: Page, locale: ComponentLocale = 'en'): Promise<void> {
  await expect(page.getByLabel(editorWorkspaceCopy[locale].body, { exact: true })).toBeVisible()
}

/**
 * The editor keeps its settings beside the document on wide layouts, and behind
 * the settings drawer trigger below 1100px. Both are the same tabs.
 */
export async function openPublicationTab(page: Page, locale: ComponentLocale): Promise<void> {
  const trigger = page.getByRole('button', { name: editorWorkspaceCopy[locale].settings, exact: true })
  if (await trigger.isVisible() && !(await page.getByRole('dialog').isVisible())) {
    await trigger.click()
  }
  await page.getByRole('tab', { name: editorWorkspaceCopy[locale].publication, exact: true }).click()
}
