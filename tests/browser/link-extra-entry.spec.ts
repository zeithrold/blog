import { expect, test } from '@playwright/test'
import { assertAccessible } from './accessibility'
import { writeDocument } from './helpers'
import {
  collapseLinkSelection,
  expectedLinkedDocument,
  linkFixture,
  linkPrefix,
  linkSaved,
  linkSelected,
  linkSuffix,
  openKeyboardLink,
  persistedLinkDocument,
  selectLinkPhrase,
} from './link-keyboard-helpers'
import { fixture, setLocale } from './preview-history-helpers'

const destination = '/posts/internal-target#part'

test('desktop empty and composing selections suppress link shortcuts without deleting text', async ({ page }) => {
  const body = await linkFixture(page, 'en', 1440)
  const before = await persistedLinkDocument(page)
  await collapseLinkSelection(page, body)
  for (const key of ['Control+k', 'Meta+k']) {
    await page.keyboard.press(key)
    await expect(page.getByRole('dialog', { name: 'Create link', exact: true })).toHaveCount(0)
    await expect(body).toHaveText(`${linkPrefix}${linkSelected}${linkSuffix}`)
  }
  await selectLinkPhrase(page, body)
  await body.dispatchEvent('compositionstart')
  try {
    for (const key of ['Control+k', 'Meta+k']) {
      await page.keyboard.press(key)
      await expect(page.getByRole('dialog', { name: 'Create link', exact: true })).toHaveCount(0)
    }
  }
  finally { await body.dispatchEvent('compositionend') }
  await linkSaved(page, 'en')
  expect((await persistedLinkDocument(page)).document).toEqual(before.document)
  expect((await persistedLinkDocument(page)).headRevisionId).toBe(before.headRevisionId)
})

test.describe('touch link entry', () => {
  test.use({ hasTouch: true })
  test('the mobile formatting drawer hands a touch selection to the link dialog', async ({ page }, info) => {
    await linkFixture(page, 'en', 390)
    await page.getByRole('button', { name: 'Appearance', exact: true }).click()
    await page.getByRole('menuitemradio', { name: 'Dark', exact: true }).click()
    await setLocale(page, 'zh')
    const body = page.getByLabel('正文', { exact: true })
    const before = await persistedLinkDocument(page)
    await selectLinkPhrase(page, body)
    await page.getByRole('button', { name: '更多格式选项', exact: true }).tap()
    await page.getByRole('dialog', { name: '格式选项', exact: true })
      .getByRole('button', { name: '添加链接', exact: true })
      .tap()
    const dialog = page.getByRole('dialog', { name: '添加链接', exact: true })
    await expect(page.locator('.formatting-options-drawer')).toHaveCount(0)
    const url = dialog.getByRole('textbox', { name: '编辑链接地址', exact: true })
    await expect(url).toBeFocused()
    await url.fill(destination)
    await assertAccessible(page, info, { label: 'touch-link-dialog-dark-zh' })
    await page.screenshot({ path: info.outputPath('touch-link-dialog-390-zh.png') })
    await dialog.getByRole('button', { name: '保存', exact: true }).tap()
    await expect(dialog).toHaveCount(0)
    await expect(body).toBeFocused()
    await linkSaved(page, 'zh')
    expect((await persistedLinkDocument(page)).document).toEqual(expectedLinkedDocument(before.document, destination))
  })
})

test('a relative link keeps its destination in the published reader', async ({ page }) => {
  const document = fixture(`${linkPrefix}${linkSelected}${linkSuffix}`)
  await writeDocument(page, document)
  const body = page.getByLabel('Document body', { exact: true })
  await selectLinkPhrase(page, body)
  const url = await openKeyboardLink(page, 'en', 'Meta')
  await url.fill(destination)
  await page.getByRole('dialog', { name: 'Create link', exact: true })
    .getByRole('button', { name: 'Save', exact: true })
    .click()
  await linkSaved(page, 'en')
  const published = page.waitForResponse(response => response.url().endsWith('/publish')
    && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  expect((await published).status()).toBe(200)
  const path = `/posts/${document.meta.slug}`
  const response = await page.request.get(path)
  expect(response.ok()).toBe(true)
  expect(await response.text()).toContain(`href="${destination}"`)
  await page.goto(path)
  await expect(page.getByRole('link', { name: linkSelected, exact: true })).toHaveAttribute('href', destination)
})
