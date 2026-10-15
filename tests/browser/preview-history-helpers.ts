import type { Locator, Page } from '@playwright/test'
import type { Recovery } from '../../src/features/editor/core/recovery'
import { expect } from '@playwright/test'
import { acknowledgementSchema, sessionSchema } from '../../src/content/contracts'
import { emptyDocument } from '../../src/content/document'
import { writeDocument } from './helpers'

export type Locale = 'en' | 'zh'
export const labels = {
  en: {
    body: 'Document body',
    settings: 'Document settings',
    content: 'Content',
    publication: 'Publication',
    preview: 'Preview',
    dialog: 'Draft preview',
    reader: 'Draft reader preview',
    closePreview: 'Close preview',
    close: 'Close',
    more: 'More document actions',
    recovery: 'Local recovery copy',
    recover: 'Open recovered draft',
    dismiss: 'Dismiss',
    history: 'Revision history',
    revision: 'Revision',
    selected: 'Selected revision',
    baseline: 'Compare against',
    saved: 'Saved',
    historical: 'Preview selected revision',
    restore: 'Restore',
  },
  zh: {
    body: '正文',
    settings: '文档设置',
    content: '内容',
    publication: '发布',
    preview: '预览',
    dialog: '草稿预览',
    reader: '草稿阅读预览',
    closePreview: '关闭预览',
    close: '关闭',
    more: '更多文档操作',
    recovery: '本地恢复副本',
    recover: '打开恢复的草稿',
    dismiss: '忽略',
    history: '修订历史',
    revision: '修订',
    selected: '所选修订',
    baseline: '对比基准',
    saved: '已保存',
    historical: '预览所选修订',
    restore: '恢复',
  },
} as const

export function fixture(body: string): ReturnType<typeof emptyDocument> {
  const document = emptyDocument()
  document.meta.title = 'A draft title that stays readable on a narrow screen'
  document.meta.slug = `preview-history-${crypto.randomUUID()}`
  const paragraph = document.blocks[0]
  if (paragraph === undefined) {
    throw new Error('The fixture has no initial paragraph')
  }
  paragraph.content = [
    { type: 'text', text: body, styles: {} },
  ]
  return document
}

export async function setLocale(page: Page, locale: Locale): Promise<void> {
  if (locale === 'zh') {
    await page.getByRole('combobox', { name: 'Language', exact: true }).click()
    await page.getByRole('option', { name: '简体中文', exact: true }).click()
    await page.reload()
    await expect(page.getByLabel(labels.zh.body, { exact: true })).toBeVisible()
  }
}

export async function horizontalBounds(page: Page, locator: Locator): Promise<void> {
  await expect.poll(async () => await locator.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    return bounds.left >= 0 && bounds.right <= window.innerWidth
  })).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
}

export async function setRecovery(page: Page, ack: ReturnType<typeof acknowledgementSchema.parse>): Promise<void> {
  const session = sessionSchema.parse(await (await page.request.get('/api/admin/session')).json())
  const snapshot: Recovery = {
    owner: session.ownerSub,
    documentId: ack.documentId,
    baseRevisionId: ack.headRevisionId,
    editSeq: 1,
    savedAt: Date.now(),
    document: fixture('A local recovery copy that was never sent to the server'),
  }
  await page.evaluate(async (recovery) => {
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
          recovery,
          `${recovery.owner}:${recovery.documentId}:blog-blocknote-v1`,
        )
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error ?? new Error('Could not write local recovery'))
        transaction.onabort = () => reject(transaction.error ?? new Error('Local recovery write was aborted'))
      })
    }
    finally {
      db.close()
    }
  }, snapshot)
}

export async function historyFixture(page: Page): Promise<{
  first: ReturnType<typeof acknowledgementSchema.parse>
  latest: ReturnType<typeof acknowledgementSchema.parse>
  blockId: string
}> {
  const document = fixture('The historical paragraph before its edit')
  const first = await writeDocument(page, document)
  const block = document.blocks[0]
  if (block === undefined) {
    throw new Error('The history fixture has no paragraph')
  }
  document.meta.title = 'The current draft title'
  block.content = [
    { type: 'text', text: 'The current paragraph after its edit', styles: {} },
  ]
  const session = sessionSchema.parse(await (await page.request.get('/api/admin/session')).json())
  const response = await page.request.put(`/api/admin/documents/${first.documentId}/revisions`, {
    data: {
      expectedVersion: first.version,
      baseRevisionId: first.headRevisionId,
      reason: 'manual',
      document,
    },
    headers: {
      'origin': new URL(page.url()).origin,
      'x-csrf-token': session.csrfToken,
      'idempotency-key': crypto.randomUUID(),
    },
  })
  expect(response.ok(), await response.text()).toBe(true)
  const latest = acknowledgementSchema.parse(await response.json())
  await page.goto(`/admin/documents/${first.documentId}`)
  await expect(page.getByLabel('Document body', { exact: true })).toBeVisible()
  return { first, latest, blockId: block.id }
}
