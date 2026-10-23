import type { TestInfo } from '@playwright/test'
import type { JourneyContext } from '~/tests/support/browser/journey'
import { emptyDocument } from '@/content/document'
import { historySchema } from '@/contracts/history'
import { sessionSchema } from '@/contracts/session'
import { saved, writeDocument } from '~/tests/support/browser/document'
import {
  documentAction,
  expect,
  layoutCheckpoint,
  navigation,
  opened,
  previewCheckpoint,
  semanticCheckpoint,
  test,
} from '~/tests/support/browser/journey'
import { inline } from './content-fixture'

const title = 'long task: two-tab conflict, history restoration, failed departure and real local recovery'

test(title, async ({ page, context, journey }, info) => {
  test.setTimeout(180000)
  const state = await prepare({ page, context, journey }, info)
  await test.step(
    'resolve a real two-tab conflict without replacing the editor',
    async () => await resolveConflict(state),
  )
  await test.step(
    'compare and restore the original revision through history, then continue editing',
    async () => await restoreHistory(state),
  )
  await test.step(
    'save during guarded navigation and preserve Back and Forward destinations',
    async () => await guardNavigation(state),
  )
  await test.step(
    'reject saves, retain the actual recovery copy, reload and recover it',
    async () => await recoverLocalCopy(state),
  )
  await test.step(
    'reopen late controls, publish and verify the recovered version publicly',
    async () => await publishRecovery(state),
  )
})

async function prepare({ page, context, journey }: JourneyContext, info: TestInfo) {
  const expected = emptyDocument()
  expected.meta.title = 'Journey recovery'
  expected.meta.slug = 'journey-recovery'
  const block = expected.blocks[0]
  if (block === undefined) {
    throw new Error('Missing recovery paragraph')
  }
  block.content = inline('Journey initial body')
  const ack = await writeDocument(page, expected)
  const path = `/api/admin/documents/${ack.documentId}`
  const editorURL = page.url()
  const second = await context.newPage()
  await second.goto(editorURL)
  await expect(second.getByLabel('Document body', { exact: true })).toBeVisible()

  return { page, context, journey, info, expected, block, ack, path, editorURL, second }
}

type State = Awaited<ReturnType<typeof prepare>>

async function resolveConflict(state: State): Promise<void> {
  const { page, journey, info, expected, block, ack, path, second } = state

  await page.getByLabel('Document body', { exact: true }).fill('Journey server body')
  await saved(page)
  const conflict = { path: `${path}/revisions`, method: 'PUT', status: 409, hits: 0, active: true }
  journey.failures.push(conflict)
  const identity = await second.getByLabel('Document body', { exact: true }).elementHandle()
  await second.getByLabel('Document body', { exact: true }).fill('Journey local winning body')
  await expect(second.getByText('Conflict — draft preserved', { exact: true })).toBeVisible({ timeout: 15000 })
  await second.getByRole('button', { name: 'Compare changes', exact: true }).click()
  await expect(second.getByRole('region', { name: 'Conflict comparison', exact: true }))
    .toContainText('The baseline is server version')
  await second.getByRole('button', { name: 'Keep local edits', exact: true }).click()
  await second.keyboard.press('Escape')
  await expect(second.getByRole('button', { name: 'Keep local edits', exact: true })).toBeFocused()
  await second.getByRole('button', { name: 'Keep local edits', exact: true }).click()
  await second.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click()
  block.content = inline('Journey local winning body')
  await semanticCheckpoint(second, info, journey, { name: 'conflict-resolved', id: ack.documentId, expected })
  expect(await identity.evaluate(element => element.isConnected)).toBe(true)
  conflict.active = false
}

async function restoreHistory(state: State): Promise<void> {
  const { page, journey, info, expected, block, ack, path, second } = state

  await documentAction(second, 'View and compare revisions')
  const history = historySchema.parse(await (await second.request.get(`${path}/revisions`)).json())
  const original = history.items.find(item => item.revisionId === ack.headRevisionId)
  expect(original).toBeDefined()
  await second.getByRole('button', { name: new RegExp(`^Revision ${original?.sequence ?? 0} `) }).click()
  await expect(second.locator('.history-selection')).toHaveAttribute('data-selected-revision', ack.headRevisionId)
  const changed = second.locator('.diff-row[data-change="changed"]')
  await changed.locator('.diff-block-trigger').click()
  await expect(changed).toContainText('Journey initial body')
  await expect(changed).toContainText('Journey local winning body')
  await layoutCheckpoint(second, info, journey, 'recovery-history-comparison')
  await second.getByRole('button', { name: 'Restore as new draft', exact: true }).click()
  await second.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(second.getByRole('status').filter({ hasText: 'Created a new draft revision' })).toBeVisible()
  expect((await opened(second, ack.documentId)).headRevisionId).not.toBe(ack.headRevisionId)
  await second.getByRole('link', { name: 'Back to editor', exact: true }).click()
  block.content = inline('Journey initial body')
  await semanticCheckpoint(second, info, journey, { name: 'history-restored', id: ack.documentId, expected })
  await page.close()
}

async function guardNavigation(state: State): Promise<void> {
  const { journey, info, expected, ack, path, second } = state

  let release = (): void => {}
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  let intercepted = false
  await second.route(`**${path}/revisions`, async (route) => {
    if (route.request().method() === 'PUT') {
      intercepted = true
      await pending
    }
    await route.continue()
  })
  try {
    await second.getByLabel('Title', { exact: true }).fill('Journey after guarded navigation')
    await navigation(second, 'Tags', false)
    await expect(second.getByRole('dialog', { name: 'Saving before leaving', exact: true })).toBeVisible()
    await expect.poll(() => intercepted).toBe(true)
    release()
    await expect(second.getByRole('heading', { name: 'Tags', exact: true })).toBeVisible()
  }
  finally {
    release()
    await second.unroute(`**${path}/revisions`)
  }
  await second.goBack()
  expected.meta.title = 'Journey after guarded navigation'
  await semanticCheckpoint(second, info, journey, { name: 'guarded-back', id: ack.documentId, expected })
  await second.goForward()
  await expect(second.getByRole('heading', { name: 'Tags', exact: true })).toBeVisible()
  await second.goBack()
  await expect(second.getByLabel('Document body', { exact: true })).toBeVisible()
}

async function recoverLocalCopy(state: State): Promise<void> {
  const { journey, info, expected, block, ack, path, second } = state

  const failure = { path: `${path}/revisions`, method: 'PUT', status: 503, hits: 0, active: true }
  journey.failures.push(failure)
  await second.route(`**${path}/revisions`, async (route) => {
    if (route.request().method() === 'PUT') {
      await route.fulfill({ status: 503, json: { code: 'CONNECTION_FAILED' } })
    }
    else {
      await route.continue()
    }
  })
  await second.getByLabel('Document body', { exact: true }).fill('Journey recovered unsent body')
  await expect(second.locator('.editor-notice[data-tone="error"]'))
    .toContainText('Connection failed', { timeout: 15000 })
  expect((await opened(second, ack.documentId)).document.blocks[0]?.content).toEqual(inline('Journey initial body'))
  await second.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })))
  const session = sessionSchema.parse(await (await second.request.get('/api/admin/session')).json())
  const key = `${session.ownerSub}:${ack.documentId}:blog-blocknote-v1`
  await expect.poll(async () => await second.evaluate(async (storageKey) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('ztd.blog.cms.recovery.v1', 1)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Recovery storage failed'))
    })
    try {
      return await new Promise<unknown>((resolve, reject) => {
        const request = db.transaction('snapshots').objectStore('snapshots').get(storageKey)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error ?? new Error('Recovery storage failed'))
      })
    }
    finally { db.close() }
  }, key)).toMatchObject({ document: { blocks: [
    { id: block.id, content: inline('Journey recovered unsent body') },
  ] } })
  await second.reload()
  await expect(second.getByRole('button', { name: 'Open recovered draft', exact: true })).toBeVisible()
  await second.unroute(`**${path}/revisions`)
  failure.active = false
  await second.getByRole('button', { name: 'Open recovered draft', exact: true }).click()
  block.content = inline('Journey recovered unsent body')
  await semanticCheckpoint(second, info, journey, { name: 'local-copy-recovered', id: ack.documentId, expected })
  await second.reload()
  await expect(second.getByRole('button', { name: 'Open recovered draft', exact: true })).toHaveCount(0)
  await semanticCheckpoint(second, info, journey, { name: 'recovery-final-reopen', id: ack.documentId, expected })
}

async function publishRecovery(state: State): Promise<void> {
  const { journey, info, ack, second } = state

  await previewCheckpoint(second, 'Journey recovered unsent body')
  await second.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(second.getByText('Published', { exact: true })).toBeVisible()
  const published = await opened(second, ack.documentId)
  expect(published.liveRevisionId).toBe(published.headRevisionId)
  expect(await (await second.request.get('/posts/journey-recovery')).text()).toContain('Journey recovered unsent body')
  await layoutCheckpoint(second, info, journey, 'recovery-published')
  await second.close()
}
