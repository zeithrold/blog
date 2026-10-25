import type { Page } from '@playwright/test'
import type { Block, Document } from '@/content/document'
import { emptyDocument } from '@/content/document'
import { writeDocument } from '~/tests/support/browser/document'
import { expect, test } from '~/tests/support/browser/test'

const textProps = {
  textAlignment: 'left',
  textColor: 'default',
  backgroundColor: 'default',
}

function heading(title: string, level: number): Block {
  return {
    id: crypto.randomUUID(),
    type: 'heading',
    props: { ...textProps, level },
    content: [
      { type: 'text', text: title, styles: {} },
    ],
    children: [],
  }
}

function readerDocument(slug: string): { document: Document, headingId: string } {
  const document = emptyDocument()
  const nestedHeading = heading('Inside nested details', 2)
  document.meta.title = 'Public reader navigation'
  document.meta.slug = `${slug}-${crypto.randomUUID()}`
  document.blocks = [
    { id: crypto.randomUUID(), type: 'toc', props: { title: 'Reader sections' }, children: [] },
    heading('First section', 1),
    heading('', 2),
    {
      id: crypto.randomUUID(),
      type: 'toggleListItem',
      props: textProps,
      content: [
        { type: 'text', text: 'Outer details', styles: {} },
      ],
      children: [
        {
          id: crypto.randomUUID(),
          type: 'toggleListItem',
          props: textProps,
          content: [
            { type: 'text', text: 'Inner details', styles: {} },
          ],
          children: [
            nestedHeading,
            {
              id: crypto.randomUUID(),
              type: 'paragraph',
              props: textProps,
              content: [
                {
                  type: 'link',
                  href: 'https://example.com',
                  content: [
                    { type: 'text', text: 'Continue reading', styles: {} },
                  ],
                },
              ],
              children: [],
            },
          ],
        },
      ],
    },
  ]
  return { document, headingId: nestedHeading.id }
}

async function publishReader(page: Page, document: Document): Promise<void> {
  await writeDocument(page, document)
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(page.getByText('Published', { exact: true })).toBeVisible()
  await page.goto(`/posts/${document.meta.slug}`)
}

test('article contents reveal nested details and continue keyboard reading at the selected heading', async ({
  page,
  browserName,
}) => {
  const { document, headingId } = readerDocument('public-reader-navigation')
  await publishReader(page, document)
  const contents = page.getByRole('navigation', { name: 'Reader sections', exact: true })
  const link = contents.getByRole('link', { name: 'Inside nested details', exact: true })
  const destination = page.locator(`#block-${headingId} h3`)
  await expect(contents.getByRole('link')).toHaveCount(2)
  await expect(page.locator('.reader details[open]')).toHaveCount(0)
  // The reader must leave a modified click to the browser. Chromium does not open
  // same-document fragment links in a new tab, so assert the reader stays untouched and
  // close whatever the browser opened before the rest of the test observes this page.
  await link.click({ modifiers: ['ControlOrMeta'] })
  await expect(page.locator('.reader details[open]')).toHaveCount(0)
  await expect(page).toHaveURL(new RegExp(`/posts/${document.meta.slug}$`))
  for (const opened of page.context().pages().filter(entry => entry !== page)) {
    await opened.close()
  }
  await link.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(new RegExp(`#block-${headingId}$`))
  await expect(page.locator('.reader details[open]')).toHaveCount(2)
  await expect(destination).toBeFocused()
  const headingPosition = await destination.boundingBox()
  const headerPosition = await page.locator('.ztd-appbar').boundingBox()
  expect(headingPosition).not.toBeNull()
  expect(headerPosition).not.toBeNull()
  expect(headingPosition?.y).toBeGreaterThanOrEqual((headerPosition?.y ?? 0) + (headerPosition?.height ?? 0))
  // Safari includes links in keyboard navigation with Option-Tab by default.
  await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab')
  await expect(page.getByRole('link', { name: 'Continue reading', exact: true })).toBeFocused()
  await page.locator('.reader summary').filter({ hasText: 'Outer details' }).click()
  await link.click()
  await expect(page.locator('.reader details[open]')).toHaveCount(2)
  await expect(destination).toBeFocused()
  await page.goBack()
  await expect(page).toHaveURL(new RegExp(`/posts/${document.meta.slug}$`))
  await page.locator('.reader summary').filter({ hasText: 'Outer details' }).click()
  await page.goForward()
  await expect(page).toHaveURL(new RegExp(`#block-${headingId}$`))
  await expect(page.locator('.reader details[open]')).toHaveCount(2)
  await expect(destination).toBeFocused()
  await page.goto(`/posts/${document.meta.slug}#block-${headingId}`)
  await page.reload()
  await expect(page.locator('.reader details[open]')).toHaveCount(2)
  await expect(destination).toBeFocused()
})
