import type { Page } from '@playwright/test'
import type { HistoryCase } from './history-fixtures'
import type { ApiCall, ApiHandler, ApiService, Held } from './http-fixtures'
import type { Document } from '@/content/document'
import type { OpenDocument } from '@/contracts/documents'
import type { Locale } from '~/tests/support/browser/locale'
import { labels } from '~/tests/support/browser/locale'
import { COMPONENT_TEST_FIXTURES } from '../src/fixtures'
import { EDITOR_WORKSPACE_DOCUMENT_ID, editorWorkspaceApi } from './editor-workspace-fixtures'
import { historyCase, openDocument } from './history-fixtures'
import { serveApi } from './http-fixtures'
import { mountSurface } from './mount'
import { expect } from './test'

/**
 * Mounts the editor workspace with this case's complete handler table.
 *
 * The shared helper declares writes only; these cases also answer reads with a
 * second server state (the draft another window saved, or the revision list), so
 * the table is the case's own.
 */
export async function mountEditor(page: Page, options: {
  readonly document: OpenDocument
  readonly width: number
  readonly locale: Locale
  readonly handlers?: Readonly<Record<string, ApiHandler>>
}): Promise<ApiService> {
  const api = await serveApi(page, {
    ...editorWorkspaceApi(options.document),
    ...options.handlers,
  })
  await page.setViewportSize({ width: options.width, height: 900 })
  await mountSurface(page, {
    surface: 'editor-workspace',
    locale: options.locale,
    route: `/admin/documents/${EDITOR_WORKSPACE_DOCUMENT_ID}`,
  })
  return api
}

/**
 * The texts the conflict cases compare: the paragraph another window saved and
 * the local paragraph this window keeps before the operator decides.
 */
export const conflictTexts = {
  server: 'The server paragraph saved by the other window',
  local: 'The local paragraph that remains preserved in this window',
  updated: 'The updated local paragraph after comparing both drafts',
} as const

/** The conflict notice copy the real draft notices render. */
export type ConflictCopy = {
  /** The merged notice that owns the conflict once the newer draft is read. */
  readonly title: string
  /** The notice shown while the newer draft is still being read. */
  readonly pending: string
  readonly pendingHelp: string
  readonly comparison: string
  readonly compare: string
  readonly differences: string
  readonly keep: string
  readonly open: string
  readonly keepHelp: string
  readonly openHelp: string
  readonly stale: string
  readonly cancel: string
}

const en: ConflictCopy = {
  title: 'Draft conflict',
  pending: 'Draft changed elsewhere',
  pendingHelp: 'Your edits are preserved. Review the latest draft before continuing.',
  comparison: 'Conflict comparison',
  compare: 'Compare changes',
  differences: 'Revision differences',
  keep: 'Keep local edits',
  open: 'Use server version',
  keepHelp: 'Save as a new draft revision.',
  openHelp: 'Your local edits stay in a recovery copy.',
  stale: 'Local content changed after this comparison. Compare again to update the differences.',
  cancel: 'Cancel',
}

export const conflictCopy: Readonly<Record<Locale, ConflictCopy>> = {
  en,
  zh: {
    title: '草稿存在冲突',
    pending: '草稿已在其他位置更新',
    pendingHelp: '你的修改已保留，请先核对最新草稿再继续。',
    comparison: '冲突内容对比',
    compare: '查看差异',
    differences: '修订差异',
    keep: '保留本地修改',
    open: '使用服务器版本',
    keepHelp: '保存为新的草稿修订。',
    openHelp: '本地修改会保留为恢复副本。',
    stale: '本地内容已继续修改，请再次对比以更新差异。',
    cancel: '取消',
  },
}

/**
 * The same document with one paragraph rewritten in place.
 *
 * The comparison matches blocks by stable id, so a fixture that rebuilt the
 * document would prove an add/remove pair instead of the changed paragraph these
 * cases are about.
 */
export function documentWithText(
  value: Document,
  change: { readonly title?: string, readonly text?: string },
): Document {
  const document = structuredClone(value)
  if (change.title !== undefined) {
    document.meta.title = change.title
  }
  if (change.text !== undefined) {
    const block = document.blocks[0]
    if (block === undefined) {
      throw new Error('The history fixture has no paragraph')
    }
    block.content = [
      { type: 'text', text: change.text, styles: {} },
    ]
  }
  return document
}

/**
 * A document stored three times where revisions 2 and 3 share block ids.
 *
 * The list, the selection and the baseline are the ones the history page lists;
 * because the two revisions keep the same paragraph id, comparing them is one
 * changed paragraph rather than an unrelated addition and removal. The draft is
 * unpublished, as it is in the editor cases these replace.
 */
export function comparableHistoryCase(): HistoryCase {
  const fixture = historyCase({
    title: 'The current draft title',
    body: 'The historical paragraph before its edit',
  })
  const current = documentWithText(fixture.first.document, {
    title: 'The current draft title',
    text: 'The current paragraph after its edit',
  })
  return {
    ...fixture,
    latest: { ...fixture.latest, document: current },
    initial: openDocument(fixture, {
      document: current,
      liveRevisionId: null,
      livePath: null,
    }),
  }
}

/** The draft this editor holds and the newer draft another window saved. */
export type ConflictDocuments = {
  readonly local: HistoryCase
  readonly remote: OpenDocument
}

export function conflictCase(): ConflictDocuments {
  const fixture = historyCase({
    title: 'The local draft title',
    body: 'The paragraph before the two windows diverged',
    latestBody: 'The paragraph before the two windows diverged',
  })
  // The draft both windows hold: an unpublished draft, as the editor cases save one.
  const draft = openDocument(fixture, { liveRevisionId: null, livePath: null })
  return {
    local: { ...fixture, initial: draft },
    remote: openDocument(fixture, {
      version: draft.version + 1,
      headRevisionId: crypto.randomUUID(),
      liveRevisionId: null,
      livePath: null,
      document: documentWithText(draft.document, {
        title: 'The server draft title',
        text: conflictTexts.server,
      }),
    }),
  }
}

/**
 * The first document read answers the draft the editor loaded; every later read
 * answers the draft the other window saved, which is what the conflict notice
 * reads. `refresh` holds that second read so the pending notice is observable.
 */
export function servedDraftChange(input: {
  readonly local: OpenDocument
  readonly remote: OpenDocument
  readonly refresh?: Held
}): ApiHandler {
  let reads = 0
  return async () => {
    reads += 1
    if (reads === 1) {
      return { body: input.local }
    }
    await input.refresh?.promise
    return { body: input.remote }
  }
}

/**
 * Writes one local recovery snapshot under the owner the harness mounts with, so
 * the next mount reads it through the product's own IndexedDB code.
 */
export async function storeRecovery(page: Page, input: {
  readonly documentId: string
  readonly baseRevisionId: string
  readonly document: Document
}): Promise<void> {
  await page.evaluate(async (snapshot) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('ztd.blog.cms.recovery.v1', 1)
      request.onupgradeneeded = () => request.result.createObjectStore('snapshots')
      request.onerror = () => reject(request.error ?? new Error('Could not open local recovery'))
      request.onsuccess = () => resolve(request.result)
    })
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction('snapshots', 'readwrite')
        transaction.objectStore('snapshots').put(
          snapshot,
          `${snapshot.owner}:${snapshot.documentId}:blog-blocknote-v1`,
        )
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error ?? new Error('Could not write local recovery'))
        transaction.onabort = () => reject(transaction.error ?? new Error('Local recovery write was aborted'))
      })
    }
    finally {
      db.close()
    }
  }, {
    owner: COMPONENT_TEST_FIXTURES.owner,
    documentId: input.documentId,
    baseRevisionId: input.baseRevisionId,
    editSeq: 1,
    savedAt: Date.now(),
    document: input.document,
  })
}

/** Every request that was not a read, so a case can assert what it wrote. */
export function writeCalls(api: ApiService): ApiCall[] {
  return api.calls.filter(call => call.method !== 'GET')
}

/** Publication writes only: what a draft preview or recovery decision must not send. */
export function publicWriteCalls(api: ApiService): ApiCall[] {
  return api.calls.filter(call => call.method !== 'GET' && /\/(?:publish|unpublish|restore)$/.test(call.path))
}

/** The editor keeps its tabs beside the document until the settings drawer appears. */
export async function openContentTab(page: Page, locale: Locale): Promise<void> {
  const trigger = page.getByRole('button', { name: labels[locale].settings, exact: true })
  if (await trigger.isVisible() && !(await page.getByRole('dialog').isVisible())) {
    await trigger.click()
  }
  await page.getByRole('tab', { name: labels[locale].content, exact: true }).click()
}

/** The draft status that only a completed server save reaches. */
export async function expectSaved(page: Page, locale: Locale): Promise<void> {
  await expect(page.getByRole('status').filter({ hasText: new RegExp(`^${labels[locale].saved}$`) }))
    .toBeVisible({ timeout: 15000 })
}
