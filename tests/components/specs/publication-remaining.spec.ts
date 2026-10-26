import type { Page } from '@playwright/test'
import type { ApiService } from '../support/http-fixtures'
import type { OpenDocument } from '@/contracts/documents'
import { withinViewport } from '~/tests/support/browser/layout'
import { editorWorkspaceDocument, paragraphBlocks, tableBlock } from '../support/editor-workspace-fixtures'
import { editorReady } from '../support/editor-workspace-ui'
import { apiKey, failure } from '../support/http-fixtures'
import { publicationCopy } from '../support/publication-remaining'
import {
  acceptSave,
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

const issueText = {
  en: [
    'Add a document title.',
    'Use a valid, unreserved slug.',
    'Add a caption to each table.',
    'Select a file for each empty media block, or remove the block.',
    'Add image alternative text or mark the image as decorative.',
  ],
  zh: [
    '请填写文档标题。',
    '请填写有效且非保留的 Slug。',
    '请为各表格填写标题说明。',
    '请为空的媒体块选择文件，或删除该块。',
    '请为图片填写替代文本，或标记为装饰图片。',
  ],
} as const

function writeCalls(api: ApiService, route: string) {
  return api.calls.filter(call => apiKey(call.method, call.path) === route)
}

function lastWrite(api: ApiService, route: string) {
  const call = writeCalls(api, route).at(-1)
  if (call === undefined) {
    throw new Error(`No ${route} request was sent`)
  }
  return call
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
      await expect(title).toHaveValue('Publication conflict')
      if (action === 'publish') {
        await page.getByRole('button', { name: copy.publish, exact: true }).click()
      }
      else {
        await unpublish(page, copy)
      }
      const conflict = page.getByRole('region', { name: copy.conflict, exact: true })
      await expect(conflict).toBeVisible()
      await expect(page.locator('.editor-publish-action')).toBeDisabled()
      await expect(title).toHaveValue('Publication conflict')
      await conflict.getByRole('button', { name: copy.compare, exact: true }).click()
      await expect(conflict.getByText(
        `The baseline is server version ${external.version}; the selected content is your local draft snapshot.`,
      )).toBeVisible()
      await conflict.getByRole('button', { name: copy.serverVersion, exact: true }).click()
      await expect(title).toHaveValue('Latest saved title')
      await expect(conflict).toHaveCount(0)
      if (action === 'publish') {
        await page.getByRole('button', { name: copy.publish, exact: true }).click()
        await expect(page.getByRole('link', { name: copy.live, exact: true })).toBeVisible()
      }
      else {
        await unpublish(page, copy)
        await expect(page.getByRole('link', { name: copy.live, exact: true })).toHaveCount(0)
      }
      const attempts = writeCalls(api, `POST /api/admin/documents/:id/${action}`)
      expect(attempts.map(expectedVersionOf)).toEqual([loaded.version, external.version])
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}

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
        await expect(notice.getByRole('heading')).toHaveText(copy.error)
        await expect(notice.locator('[data-publication-description]')).toHaveText(issueText[locale])
        await expect(notice).not.toContainText('INVALID_DOCUMENT')
        await expect(notice).not.toContainText('PUBLICATION_INVALID')
        await notice.scrollIntoViewIfNeeded()
        await withinViewport(page, notice)
        await page.screenshot({
          path: info.outputPath(`publication-rejection-${width}-${locale}.png`),
        })
        const attempts = writeCalls(api, 'POST /api/admin/documents/:id/publish')
        expect(attempts).toHaveLength(1)
        expect(attempts[0]?.json).toEqual({
          expectedVersion: document.version,
          expectedLiveGeneration: document.liveGeneration,
          revisionId: document.headRevisionId,
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
      const notice = page.getByRole('region', { name: copy.error, exact: true })
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

for (const failureCase of [
  { status: 413, code: 'DOCUMENT_TOO_LARGE', message: 'The document exceeds the size limit.' },
  { status: 422, code: 'INVALID_DOCUMENT', message: 'The document failed validation.' },
  { status: 0, code: 'CONNECTION_FAILED', message: 'Connection failed.' },
]) {
  test(`publishing retains the save failure reason ${failureCase.code} and permits correction`, async ({ page }) => {
    const document = publicationDocument('Save failure')
    const state = publicationState(document)
    let failSaves = true
    let savedHead: string | undefined
    const api = await mountPublicationWorkspace(page, {
      state,
      writes: {
        'PUT /api/admin/documents/:id/revisions': (call) => {
          if (failSaves) {
            return failureCase.status === 0
              ? { abort: 'failed' as const }
              : failure(failureCase.status, failureCase.code)
          }
          const reply = acceptSave(state, call)
          savedHead = state.open.headRevisionId
          return reply
        },
      },
    })
    const copy = publicationCopy.en
    try {
      await editorReady(page)
      const title = page.getByLabel(copy.title, { exact: true })
      const publish = page.getByRole('button', { name: copy.publish, exact: true })
      await title.fill('Changed draft')
      await publish.click()
      const notice = page.locator('.editor-notice[data-tone="error"]')
      await expect(notice).toContainText(failureCase.message)
      await publish.click()
      await expect(notice).toContainText(failureCase.message)
      await expect(notice).not.toContainText('Wait for the draft')
      expect(writeCalls(api, 'POST /api/admin/documents/:id/publish')).toHaveLength(0)
      failSaves = false
      await title.fill('Corrected draft')
      await publish.click()
      await expect(page.getByRole('link', { name: copy.live, exact: true })).toBeVisible()
      await expect(notice).toHaveCount(0)
      const published = writeCalls(api, 'POST /api/admin/documents/:id/publish')
      expect(published).toHaveLength(1)
      expect(published[0]?.json).toMatchObject({ revisionId: savedHead })
      expect(savedTitleOf(lastWrite(api, 'PUT /api/admin/documents/:id/revisions')))
        .toBe('Corrected draft')
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}
