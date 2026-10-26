import { saved, writeDocument } from '~/tests/support/browser/document'
import { fixture } from '~/tests/support/browser/document-fixture'
import { expect, test } from '~/tests/support/browser/test'
import { persistedLinkDocument } from './link-keyboard-helpers'

const oldLink = 'https://example.com/old'

// The one stored unlink representative: URL-shaped text must stay text through a real save
// and a reload, which the component cases can only prove up to the revision packet.
test('unlink keeps URL-shaped text unlinked after saving and reloading', async ({ page }) => {
  const document = fixture('')
  const block = document.blocks[0]
  if (block === undefined) {
    throw new Error('Missing paragraph')
  }
  block.content = [
    { type: 'link', href: oldLink, content: [
      { type: 'text', text: 'https://example.com ', styles: {} },
    ] },
  ]
  await writeDocument(page, document)
  const body = page.getByLabel('Document body', { exact: true })
  await body.locator('a').click()
  await page.locator('.bn-link-toolbar').getByRole('button', { name: 'Remove link', exact: true }).click()
  await saved(page)
  await expect(body.locator('a')).toHaveCount(0)
  await expect(body).toHaveText('https://example.com ')
  const expected = [
    { type: 'text', text: 'https://example.com ', styles: {} },
  ]
  expect((await persistedLinkDocument(page)).document.blocks[0]?.content).toEqual(expected)
  await page.reload()
  await expect(body.locator('a')).toHaveCount(0)
  expect((await persistedLinkDocument(page)).document.blocks[0]?.content).toEqual(expected)
})
