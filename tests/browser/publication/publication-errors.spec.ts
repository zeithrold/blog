import { emptyDocument } from '@/content/document'
import { fixture } from '~/tests/browser/editor/blocks/block-action-helpers'
import { tableDocument } from '~/tests/browser/editor/tables/table-overlay-helpers'
import { saved, writeDocument } from '~/tests/support/browser/document'
import { withinViewport } from '~/tests/support/browser/layout'
import { setChinese } from '~/tests/support/browser/locale'
import { expect, test } from '~/tests/support/browser/test'

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
}

function incompleteDocument(): ReturnType<typeof tableDocument> {
  const document = tableDocument()
  document.meta.title = ''
  document.meta.slug = ''
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
  return document
}

for (const width of [1440, 320]) {
  for (const locale of ['en', 'zh'] as const) {
    test(`publication explains every rejection at ${width}px in ${locale}`, async ({ page }, info) => {
      const pageErrors: string[] = []
      page.on('pageerror', error => pageErrors.push(error.message))
      await page.setViewportSize({ width, height: 900 })
      const initial = await writeDocument(page, incompleteDocument())
      if (locale === 'zh') {
        await setChinese(page)
      }
      const response = page.waitForResponse(result => result.url().endsWith('/publish')
        && result.request().method() === 'POST')
      await page.getByRole('button', { name: locale === 'en' ? 'Publish' : '发布', exact: true }).click()
      const rejected = await response
      expect(rejected.status()).toBe(422)
      expect(await rejected.json()).toMatchObject({
        code: 'PUBLICATION_INVALID',
        issues: [
          'title',
          'slug',
          'table',
          'mediaSource',
          'image',
        ],
      })
      const notice = page.locator('.editor-notice[data-tone="error"]')
      await expect(notice.getByRole('heading')).toHaveText(locale === 'en'
        ? 'Publication checks failed'
        : '发布未通过检查')
      await expect(notice.locator('[data-publication-description]')).toHaveText(issueText[locale])
      await expect(notice).not.toContainText('INVALID_DOCUMENT')
      await expect(notice).not.toContainText('PUBLICATION_INVALID')
      await notice.scrollIntoViewIfNeeded()
      await withinViewport(page, notice)
      await page.screenshot({ path: info.outputPath(`publication-rejection-${width}-${locale}.png`) })
      const current: unknown = await (await page.request.get(`/api/admin/documents/${initial.documentId}`)).json()
      expect(current).toMatchObject({
        version: initial.version,
        headRevisionId: initial.headRevisionId,
        liveRevisionId: null,
        liveGeneration: initial.liveGeneration,
      })
      expect(pageErrors).toEqual([])
    })
  }
}

test('correcting a rejected draft clears its reasons and publishes the saved content', async ({ page }) => {
  const document = emptyDocument()
  document.meta.slug = `publication-retry-${crypto.randomUUID()}`
  await writeDocument(page, document)
  const publish = page.getByRole('button', { name: 'Publish', exact: true })
  await publish.click()
  const notice = page.locator('.editor-notice[data-tone="error"]')
  await expect(notice.locator('[data-publication-description]')).toHaveText(['Add a document title.'])
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Corrected publication')
  await saved(page)
  await expect(notice).toHaveCount(0)
  const response = page.waitForResponse(result => result.url().endsWith('/publish')
    && result.request().method() === 'POST')
  await publish.click()
  expect((await response).status()).toBe(200)
  await expect(page.getByRole('link', { name: 'View live document', exact: true })).toBeVisible()
  const publicPage = await page.request.get(`/posts/${document.meta.slug}`)
  expect(publicPage.ok()).toBe(true)
  expect(await publicPage.text()).toContain('Corrected publication')
  await expect(notice).toHaveCount(0)
})

for (const width of [1440, 320]) {
  test(`publication rejection is revealed from the end of a long document at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 740 })
    const document = fixture(40)
    document.meta.title = ''
    await writeDocument(page, document)
    const lastBlock = page.getByLabel('Document body', { exact: true }).locator('.bn-block-content').last()
    const notice = page.getByRole('region', { name: 'Publication checks failed', exact: true })
    for (let attempt = 0; attempt < 2; attempt++) {
      await lastBlock.scrollIntoViewIfNeeded()
      expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(1000)
      const rejected = page.waitForResponse(response => response.url().endsWith('/publish')
        && response.request().method() === 'POST')
      await page.getByRole('button', { name: 'Publish', exact: true }).click()
      expect((await rejected).status()).toBe(422)
      await expect(notice).toBeInViewport()
      await expect(notice).toBeFocused()
      const headerBottom = await page.locator('.workspace-header').evaluate(element =>
        element.getBoundingClientRect().bottom)
      const noticeTop = await notice.evaluate(element => element.getBoundingClientRect().top)
      expect(noticeTop).toBeGreaterThanOrEqual(headerBottom)
    }
  })
}
