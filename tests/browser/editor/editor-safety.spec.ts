import type { Page } from '@playwright/test'
import type { Recovery } from '@/features/editor/draft/recovery'
import { emptyDocument } from '@/content/document'
import { openDocumentSchema } from '@/contracts/documents'
import { sessionSchema } from '@/contracts/session'
import { saved, writeDocument } from '~/tests/support/browser/document'
import { settingsTab } from '~/tests/support/browser/settings'
import { expect, test } from '~/tests/support/browser/test'

function documentWithBody(body: string): ReturnType<typeof emptyDocument> {
  const document = emptyDocument()
  document.meta.title = 'Editor safety document'
  document.meta.slug = `editor-safety-${crypto.randomUUID()}`
  const paragraph = document.blocks[0]
  if (paragraph === undefined) {
    throw new Error('Missing initial paragraph')
  }
  paragraph.content = [
    { type: 'text', text: body, styles: {} },
  ]
  return document
}

async function recoveryKey(page: Page, documentId: string): Promise<{ owner: string, key: string }> {
  const session = sessionSchema.parse(await (await page.request.get('/api/admin/session')).json())
  return {
    owner: session.ownerSub,
    key: `${session.ownerSub}:${documentId}:blog-blocknote-v1`,
  }
}

async function localCopy(page: Page, key: string, snapshot?: Recovery): Promise<unknown> {
  return await page.evaluate(async ({ key: storageKey, snapshot: recoverySnapshot }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('ztd.blog.cms.recovery.v1', 1)
      request.onupgradeneeded = () => request.result.createObjectStore('snapshots')
      request.onerror = () => reject(request.error ?? new Error('Could not open local recovery'))
      request.onsuccess = () => resolve(request.result)
    })
    try {
      return await new Promise<unknown>((resolve, reject) => {
        const tx = db.transaction('snapshots', recoverySnapshot === undefined ? 'readonly' : 'readwrite')
        const store = tx.objectStore('snapshots')
        const request = recoverySnapshot === undefined ? store.get(storageKey) : store.put(recoverySnapshot, storageKey)
        let value: unknown = null
        request.onsuccess = () => {
          value = request.result
        }
        tx.oncomplete = () => resolve(value)
        tx.onerror = () => reject(tx.error ?? new Error('Could not access local recovery'))
        tx.onabort = () => reject(tx.error ?? new Error('Local recovery transaction aborted'))
      })
    }
    finally {
      db.close()
    }
  }, { key, snapshot })
}

async function pagehideCheckpoint(page: Page): Promise<void> {
  // A persisted pagehide keeps the document alive, as when entering the back/
  // forward cache. Allow the real listener's asynchronous recovery write to finish.
  await page.evaluate(async () => {
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }))
    await new Promise((resolve) => {
      setTimeout(resolve, 300)
    })
  })
}

async function unsupportedPaste(page: Page): Promise<void> {
  await page.getByLabel('Document body', { exact: true }).evaluate((element) => {
    const clipboard = new DataTransfer()
    clipboard.setData('text/plain', 'A rejected clipboard fallback')
    clipboard.setData(
      'blocknote/html',
      '<p><span data-inline-content-type="citation" data-reference-id="invalid">Citation</span></p>',
    )
    element.dispatchEvent(new ClipboardEvent('paste', {
      clipboardData: clipboard,
      bubbles: true,
      cancelable: true,
    }))
  })
}

test('an untouched editor preserves an existing recovery copy across lifecycle checkpoints', async ({ page }) => {
  const document = documentWithBody('The server revision')
  const ack = await writeDocument(page, document)
  const { owner, key } = await recoveryKey(page, ack.documentId)
  const recovered = documentWithBody('An unsaved recovery copy')
  const snapshot: Recovery = {
    owner,
    documentId: ack.documentId,
    baseRevisionId: ack.headRevisionId,
    editSeq: 1,
    savedAt: Date.now(),
    document: recovered,
  }
  await localCopy(page, key, snapshot)
  await page.reload()
  const recover = page.getByRole('button', { name: 'Open recovered draft', exact: true })
  await expect(recover).toBeVisible()
  await pagehideCheckpoint(page)
  expect(await localCopy(page, key)).toEqual(snapshot)
  await page.reload()
  await expect(recover).toBeVisible()
  await recover.click()
  await expect(page.getByLabel('Document body', { exact: true })).toContainText('An unsaved recovery copy')
})

test('a lifecycle checkpoint updates recovery after the server has saved the edit', async ({ page }) => {
  const ack = await writeDocument(page, documentWithBody('Before the edit'))
  const { key } = await recoveryKey(page, ack.documentId)
  await page.getByLabel('Document body', { exact: true }).fill('The saved edit')
  await saved(page)
  const server = openDocumentSchema.parse(await (await page.request.get(
    `/api/admin/documents/${ack.documentId}`,
  )).json())
  expect(server.headRevisionId).not.toBe(ack.headRevisionId)
  await pagehideCheckpoint(page)
  await expect.poll(async () => await localCopy(page, key)).toMatchObject({
    baseRevisionId: server.headRevisionId,
    document: server.document,
  })
  await page.reload()
  await expect(page.getByLabel('Document body', { exact: true })).toContainText('The saved edit')
  await expect(page.getByRole('button', { name: 'Open recovered draft', exact: true })).toHaveCount(0)
})

test('restoring a revision locks toolbar and plain-text fallback commands until reopening', async ({ page }) => {
  const original = 'The historical body'
  const ack = await writeDocument(page, documentWithBody(original))
  const body = page.getByLabel('Document body', { exact: true })
  await body.fill('The latest draft body')
  await saved(page)
  await unsupportedPaste(page)
  const pastePlain = page.getByRole('button', { name: 'Paste as plain text', exact: true })
  await expect(pastePlain).toBeVisible()
  await settingsTab(page, 'Publication')
  await page.getByRole('button', { name: 'Revision history', exact: true }).click()
  const revision = page.locator('.revision-list li').filter({
    has: page.getByText('Revision 2', { exact: true }),
  })
  await revision.getByRole('button', { name: 'Restore', exact: true }).click()

  let release: () => void = () => {}
  const responseGate = new Promise<void>((resolve) => {
    release = resolve
  })
  let requested: () => void = () => {}
  const requestStarted = new Promise<void>((resolve) => {
    requested = resolve
  })
  await page.route(`**/api/admin/documents/${ack.documentId}/restore`, async (route) => {
    requested()
    await responseGate
    await route.continue()
  })
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click()
  await requestStarted
  try {
    await expect(body).toHaveAttribute('contenteditable', 'false')
    const toolbar = page.getByRole('toolbar', { name: 'Editor actions', exact: true })
    await expect(toolbar.getByRole('button')).toHaveCount(8)
    for (const button of await toolbar.getByRole('button').all()) {
      await expect(button).toBeDisabled()
      await button.dispatchEvent('click')
    }
    await expect(pastePlain).toBeDisabled()
    await pastePlain.dispatchEvent('click')
    await expect(body).toContainText('The latest draft body')
    await expect(body).not.toContainText('A rejected clipboard fallback')
  }
  finally {
    release()
  }
  await expect(body).toContainText(original)
  await saved(page)
  await expect(page.getByRole('toolbar', { name: 'Editor actions', exact: true })
    .getByRole('button', { name: 'Undo', exact: true })).toBeEnabled()
})
