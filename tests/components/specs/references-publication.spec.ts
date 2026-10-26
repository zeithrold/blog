import type { Locator, Page } from '@playwright/test'
import type { ApiReply } from '../support/http-fixtures'
import type { OpenDocument } from '@/contracts/documents'
import { editorWorkspaceDocument } from '../support/editor-workspace-fixtures'
import { mountEditorWorkspace } from '../support/editor-workspace-ui'
import { defer } from '../support/http-fixtures'
import { openReferenceList } from '../support/reference-ui'
import { expect, test } from '../support/test'

/**
 * Every reference mutation the list offers for the unused reference in this
 * fixture: adding, editing and removing are one state.
 */
function mutations(page: Page): Locator[] {
  return [
    'Add reference',
    'Edit reference: Unused reference',
    'Remove reference: Unused reference',
  ].map(name => page.getByRole('button', { name, exact: true }))
}

/** A publish in flight closes every one of them. */
async function expectLocked(page: Page): Promise<void> {
  for (const control of mutations(page)) {
    await expect(control).toBeDisabled()
  }
}

/** So does every other busy state end. */
async function expectAvailable(page: Page): Promise<void> {
  for (const control of mutations(page)) {
    await expect(control).toBeEnabled()
  }
}

/** The acknowledgement a publish answers with: the head revision is now live. */
function publishedAck(draft: OpenDocument): ApiReply {
  return {
    body: {
      documentId: draft.documentId,
      version: draft.version,
      headRevisionId: draft.headRevisionId,
      liveRevisionId: draft.headRevisionId,
      liveGeneration: 1,
    },
  }
}

/**
 * Publishing holds every reference mutation until the server answers: the list
 * belongs to the saved draft, so an edit accepted mid-publish would disagree
 * with what the publish sent.
 *
 * The gate is the publish reply, not the route: the case holds the POST and
 * answers it, and the document read that follows reports the live revision, so
 * the header's live link is the real state change. No Worker is involved and no
 * component is replaced.
 */
test('publication keeps reference mutations disabled until its response arrives', async ({ page }) => {
  const draft = editorWorkspaceDocument('Reference publication', (document) => {
    document.references = [
      {
        id: crypto.randomUUID(),
        title: 'Unused reference',
        authors: ['Author'],
        year: null,
        url: '',
        doi: '',
      },
    ]
  })
  const published: OpenDocument = {
    ...draft,
    liveRevisionId: draft.headRevisionId,
    liveGeneration: 1,
    livePath: '/posts/reference-publication',
  }
  const held = defer()
  let accepted = false
  const api = await mountEditorWorkspace(page, {
    document: draft,
    writes: {
      // The read after a publish is answered with the published revision, which
      // is what the live link is verified against.
      'GET /api/admin/documents/:id': () => ({ body: accepted ? published : draft }),
      'POST /api/admin/documents/:id/publish': async () => {
        await held.promise
        accepted = true
        return publishedAck(draft)
      },
    },
  })
  try {
    await openReferenceList(page)
    // The reference is unused, so every mutation starts out available.
    await expectAvailable(page)
    const requested = page.waitForRequest(request => request.url().endsWith('/publish'))
    await page.getByRole('button', { name: 'Publish', exact: true }).click()
    await requested
    await expectLocked(page)
    held.open()
    await expect(page.getByRole('link', { name: 'View live document', exact: true })).toBeVisible()
    await expectAvailable(page)
    await api.expectServed()
  }
  finally {
    held.open()
    await api.dispose()
  }
})
