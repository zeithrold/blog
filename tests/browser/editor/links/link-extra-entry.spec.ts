import { writeDocument } from '~/tests/support/browser/document'
import { fixture } from '~/tests/support/browser/document-fixture'
import { expect, test } from '~/tests/support/browser/test'
import {
  linkPrefix,
  linkSaved,
  linkSelected,
  linkSuffix,
  openKeyboardLink,
  selectLinkPhrase,
} from './link-keyboard-helpers'

const destination = '/posts/internal-target#part'

// The one stored publication representative: a relative destination has to survive the real
// publish write and reach both the public page HTML and the rendered reader.
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
