import type { Page } from '@playwright/test'
import type { OpenDocument } from '@/contracts/documents'
import { publishSchema } from '@/contracts/publication'
import { withinViewport } from '~/tests/support/browser/layout'
import { editorWorkspaceDocument, paragraphBlocks, tableBlock } from '../support/editor-workspace-fixtures'
import { editorReady } from '../support/editor-workspace-ui'
import { publicationCopy } from '../support/publication-remaining'
import {
  expectedVersionOf,
  mountPublicationWorkspace,
  publicationDocument,
  publicationState,
  savedAhead,
  savedTitleOf,
} from '../support/publication-remaining-server'
import { expect, test } from '../support/test'

const issues = [
  'title',
  'slug',
  'table',
  'mediaSource',
  'image',
] as const

/** The document every rejection matrix starts from: five named problems. */
function incompleteDocument(): OpenDocument {
  return editorWorkspaceDocument('', (document) => {
    document.meta.title = ''
    document.meta.slug = ''
    document.blocks.unshift(tableBlock())
    const imageId = crypto.randomUUID()
    document.blocks.push({
      id: imageId,
      type: 'image',
      props: {
        url: '',
        name: '',
        caption: '',
        backgroundColor: 'default',
        textAlignment: 'left',
        showPreview: true,
      },
      children: [],
    })
    document.mediaAccessibility[imageId] = {
      alt: '',
      decorative: false,
      transcript: '',
      captionAssetId: null,
      posterAssetId: null,
    }
  })
}

for (const action of ['publish', 'unpublish'] as const) {
  test(`a clean tab resolves a ${action} conflict before retrying`, async ({ page }) => {
    const loaded = publicationDocument('Publication conflict')
    if (action === 'unpublish') {
      loaded.liveRevisionId = loaded.headRevisionId
      loaded.liveGeneration = 1
      loaded.livePath = `/posts/${loaded.document.meta.slug}`
    }
    const external = savedAhead(loaded, 'Latest saved title')
    const state = publicationState(loaded)
    const api = await mountPublicationWorkspace(page, { state, width: 1440 })
    const copy = publicationCopy.en
    try {
      await editorReady(page)
      // The other tab saved after this editor loaded, so every write below
      // carries the version this tab still knows.
      state.open = external
      const title = page.getByLabel(copy.title, { exact: true })
      if (action === 'publish') {
        await page.getByRole('button', { name: copy.publish, exact: true }).click()
      }
      else {
        await unpublish(page, copy)
      }
      await page.getByRole('button', { name: copy.compare, exact: true }).click()
      await expect(page.getByText(
        `The baseline is server version ${external.version}; the selected content is your local draft snapshot.`,
      )).toBeVisible()
      await page.getByRole('button', { name: copy.serverVersion, exact: true }).click()
      await expect(title).toHaveValue('Latest saved title')
      if (action === 'publish') {
        await page.getByRole('button', { name: copy.publish, exact: true }).click()
      }
      else {
        await unpublish(page, copy)
      }
      const attempts = api.calls.filter(call =>
        call.method === 'POST'
        && call.path === `/api/admin/documents/${loaded.documentId}/${action}`)
      expect(attempts.map(expectedVersionOf)).toEqual([loaded.version, external.version])
      if (action === 'publish') {
        expect(publishSchema.parse(attempts[1]?.json).revisionId).toBe(external.headRevisionId)
        await expect(page.getByRole('link', { name: copy.live, exact: true })).toBeVisible()
      }
      else {
        await expect(page.getByRole('link', { name: copy.live, exact: true })).toHaveCount(0)
      }
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}

test('the real Title field drives dirty status and saves corrected metadata', async ({ page }) => {
  const document = publicationDocument('Title field wiring')
  const state = publicationState(document)
  const api = await mountPublicationWorkspace(page, { state })
  const title = page.getByLabel(publicationCopy.en.title, { exact: true })
  const status = page.locator('.save-status')
  const savePath = `/api/admin/documents/${document.documentId}/revisions`
  const saves = () => api.calls.filter(call => call.method === 'PUT' && call.path === savePath)
  try {
    await editorReady(page)
    await title.fill('First saved title')
    await expect(status).toHaveAttribute('data-status', 'dirty')
    await expect(status).toHaveAttribute('data-status', 'saved', { timeout: 15000 })
    expect(saves()).toHaveLength(1)
    const firstSave = saves()[0]
    if (firstSave === undefined) {
      throw new Error('The first title edit did not save')
    }
    expect(expectedVersionOf(firstSave)).toBe(document.version)
    expect(savedTitleOf(firstSave)).toBe('First saved title')
    const firstHead = state.open.headRevisionId

    await title.fill('Corrected title')
    await expect(status).toHaveAttribute('data-status', 'dirty')
    await expect(status).toHaveAttribute('data-status', 'saved', { timeout: 15000 })
    expect(saves()).toHaveLength(2)
    const correctedSave = saves()[1]
    if (correctedSave === undefined) {
      throw new Error('The corrected title did not save')
    }
    expect(expectedVersionOf(correctedSave)).toBe(document.version + 1)
    expect(savedTitleOf(correctedSave)).toBe('Corrected title')
    expect(state.open.headRevisionId).not.toBe(firstHead)
    expect(state.open.document.meta.title).toBe('Corrected title')
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

async function unpublish(page: Page, copy: typeof publicationCopy.en): Promise<void> {
  await page.getByRole('button', { name: copy.more, exact: true }).click()
  await page.getByRole('menuitem', { name: copy.unpublish, exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: copy.confirm, exact: true }).click()
}

for (const width of [1440, 320]) {
  for (const locale of ['en', 'zh'] as const) {
    test(`publication explains every rejection at ${width}px in ${locale}`, async ({ page }, info) => {
      const document = incompleteDocument()
      const state = publicationState(document)
      const api = await mountPublicationWorkspace(page, {
        state,
        width,
        locale,
        writes: {
          'POST /api/admin/documents/:id/publish': () => ({
            status: 422,
            body: { code: 'PUBLICATION_INVALID', issues },
          }),
        },
      })
      const copy = publicationCopy[locale]
      try {
        await editorReady(page, locale)
        await page.getByRole('button', { name: copy.publish, exact: true }).click()
        const notice = page.locator('.editor-notice[data-tone="error"]')
        await notice.scrollIntoViewIfNeeded()
        await withinViewport(page, notice)
        await page.screenshot({
          path: info.outputPath(`publication-rejection-${width}-${locale}.png`),
        })
        await api.expectServed()
      }
      finally {
        await api.dispose()
      }
    })
  }
}

for (const width of [1440, 320]) {
  test(`publication rejection is revealed from the end of a long document at ${width}px`, async ({ page }) => {
    const document = editorWorkspaceDocument('', (body) => {
      body.blocks = paragraphBlocks(40)
    })
    const state = publicationState(document)
    const api = await mountPublicationWorkspace(page, {
      state,
      width,
      height: 740,
      writes: {
        'POST /api/admin/documents/:id/publish': () => ({
          status: 422,
          body: { code: 'PUBLICATION_INVALID', issues: ['title'] },
        }),
      },
    })
    const copy = publicationCopy.en
    try {
      await editorReady(page)
      const body = page.getByLabel(copy.body, { exact: true })
      const lastBlock = body.locator('.bn-block-content').last()
      const notice = page.locator('.editor-notice[data-tone="error"]')
      for (let attempt = 0; attempt < 2; attempt++) {
        await lastBlock.scrollIntoViewIfNeeded()
        expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(1000)
        await page.getByRole('button', { name: copy.publish, exact: true }).click()
        await expect(notice).toBeInViewport()
        await expect(notice).toBeFocused()
        const headerBottom = await page.locator('.workspace-header')
          .evaluate(element => element.getBoundingClientRect().bottom)
        const noticeTop = await notice.evaluate(element => element.getBoundingClientRect().top)
        expect(noticeTop).toBeGreaterThanOrEqual(headerBottom)
      }
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}
