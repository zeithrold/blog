import type { Page } from '@playwright/test'
import type { ApiHandler, ApiService, Held } from '../support/http-fixtures'
import type { OpenDocument } from '@/contracts/documents'
import { editorWorkspaceDocument } from '../support/editor-workspace-fixtures'
import { editorReady, mountEditorWorkspace } from '../support/editor-workspace-ui'
import { defer } from '../support/http-fixtures'
import { expect, test } from '../support/test'

const savedRevisionId = 'd6bb4d26-11d9-45ba-8eb4-b10ee8a87e44'
const verifiedPath = '/posts/verified-live-document'

type PublicationState = {
  documents: number
  publications: number
}

type LiveLinkScenario = {
  initial: OpenDocument
  state: PublicationState
  api: ApiService
  matchingReadStarted: Held
  matchingReadHeld: Held
  /** Opened when the client's post-publish re-read reaches the handler. */
  secondReadStarted: Held
}

function publicationAck(initial: OpenDocument, revisionId: string, version: number, liveGeneration: number) {
  return {
    body: {
      documentId: initial.documentId,
      version,
      headRevisionId: revisionId,
      liveRevisionId: revisionId,
      liveGeneration,
    },
  }
}

function liveLinkHandlers(
  initial: OpenDocument,
  state: PublicationState,
  holds: {
    readonly matchingReadStarted: Held
    readonly matchingReadHeld: Held
    readonly secondReadStarted: Held
  },
): Readonly<Record<string, ApiHandler>> {
  const firstPublished = initial.headRevisionId
  const verified = {
    ...initial,
    version: 3,
    headRevisionId: savedRevisionId,
    liveRevisionId: savedRevisionId,
    liveGeneration: 2,
    livePath: verifiedPath,
  }
  return {
    'GET /api/admin/documents/:id': async () => {
      state.documents += 1
      if (state.documents === 1) {
        return { body: initial }
      }
      if (state.documents === 2) {
        holds.secondReadStarted.open()
        return { body: { ...initial, liveRevisionId: null, livePath: null } }
      }
      holds.matchingReadStarted.open()
      await holds.matchingReadHeld.promise
      return { body: verified }
    },
    'PUT /api/admin/documents/:id/revisions': () => ({
      body: {
        documentId: initial.documentId,
        version: 2,
        headRevisionId: savedRevisionId,
        liveRevisionId: firstPublished,
        liveGeneration: 1,
        unchanged: false,
      },
    }),
    'POST /api/admin/documents/:id/publish': () => {
      state.publications += 1
      return state.publications === 1
        ? publicationAck(initial, firstPublished, 1, 1)
        : publicationAck(initial, savedRevisionId, 3, 2)
    },
  }
}

async function mountLiveLinkScenario(page: Page): Promise<LiveLinkScenario> {
  const initial = editorWorkspaceDocument('Verified live link')
  const state = { documents: 0, publications: 0 }
  const matchingReadStarted = defer()
  const matchingReadHeld = defer()
  const secondReadStarted = defer()
  const api = await mountEditorWorkspace(page, {
    document: initial,
    writes: liveLinkHandlers(initial, state, { matchingReadStarted, matchingReadHeld, secondReadStarted }),
  })
  return { initial, state, api, matchingReadStarted, matchingReadHeld, secondReadStarted }
}

async function expectMismatchKeepsLinkHidden(page: Page, scenario: LiveLinkScenario): Promise<void> {
  await editorReady(page)
  const firstPublish = page.waitForResponse(response =>
    response.request().method() === 'POST' && response.url().endsWith('/publish'))
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await firstPublish
  // The post-publish re-read is issued from a client effect, so the publish ack
  // says nothing about whether it has started. `expectServed` only drains what
  // has already reached the boundary, so counting alone encoded an ordering the
  // harness never enforced. Wait for the read to reach the handler, then let it
  // be served, and only then assert the count and the hidden link.
  await scenario.secondReadStarted.promise
  await scenario.api.expectServed()
  expect(scenario.state.documents).toBe(2)
  await expect(page.getByRole('link', { name: 'View live document', exact: true })).toHaveCount(0)
}

async function saveNewRevision(page: Page): Promise<void> {
  const revisionWrite = page.waitForResponse(response =>
    response.request().method() === 'PUT' && response.url().endsWith('/revisions'))
  await page.getByLabel('Title', { exact: true }).fill('A newer draft revision')
  await revisionWrite
  await expect(page.locator('.admin-save-status'))
    .toHaveAttribute('data-status', 'saved', { timeout: 15000 })
}

async function expectMatchingReadRevealsLink(
  page: Page,
  scenario: LiveLinkScenario,
): Promise<void> {
  const matchingRead = page.waitForRequest(request =>
    request.method() === 'GET' && request.url().endsWith(`/api/admin/documents/${scenario.initial.documentId}`))
  const secondPublish = page.waitForResponse(response =>
    response.request().method() === 'POST' && response.url().endsWith('/publish'))
  await page.getByRole('button', { name: 'Update publication', exact: true }).click()
  await secondPublish
  await scenario.matchingReadStarted.promise
  expect(scenario.state.documents).toBe(3)
  const liveLink = page.getByRole('link', { name: 'View live document', exact: true })
  await expect(liveLink).toHaveCount(0)

  scenario.matchingReadHeld.open()
  await matchingRead
  await scenario.api.expectServed()
  await expect(liveLink).toHaveAttribute('href', verifiedPath)
  expect(scenario.api.calls
    .filter(call => call.method === 'POST' && call.path.endsWith('/publish'))
    .map(call => call.json))
    .toEqual([
      { expectedVersion: 0, expectedLiveGeneration: 0, revisionId: scenario.initial.headRevisionId },
      { expectedVersion: 2, expectedLiveGeneration: 1, revisionId: savedRevisionId },
    ])
}

test('published live link waits for a matching document revision read', async ({ page }) => {
  const scenario = await mountLiveLinkScenario(page)
  try {
    await expectMismatchKeepsLinkHidden(page, scenario)
    await saveNewRevision(page)
    await expectMatchingReadRevealsLink(page, scenario)
  }
  finally {
    scenario.matchingReadHeld.open()
    await scenario.api.dispose()
  }
})
