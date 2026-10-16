import { persistedLinkDocument } from '~/tests/browser/editor/links/link-keyboard-helpers'
import { saved, writeDocument } from '~/tests/support/browser/document'
import { fixture } from '~/tests/support/browser/document-fixture'
import { expect, test } from '~/tests/support/browser/test'

const editableBlocks = [
  { type: 'callout', title: 'Callout', props: { tone: 'info' }, text: 'Immediate custom text', width: 390 },
  { type: 'footnote', title: 'Footnote', props: {}, text: 'Immediate footnote text', width: 1440 },
  { type: 'math', title: 'Formula', props: {}, text: 'a^2+b^2=c^2', width: 320 },
  { type: 'mermaid', title: 'Diagram', props: { description: '' }, text: 'graph TD; A-->B', width: 390 },
] as const

for (const block of editableBlocks) {
  const description = `a custom slash ${block.type} replaces its empty paragraph and immediately accepts typing`
  test(description, async ({ page }, info) => {
    await page.setViewportSize({ width: block.width, height: 740 })
    const document = fixture('')
    document.meta.title = `Slash ${block.type} insertion`
    await writeDocument(page, document)
    const before = await persistedLinkDocument(page)
    const body = page.getByLabel('Document body', { exact: true })
    await body.focus()
    await page.keyboard.type(`/${block.type}`)
    await expect(page.getByRole('option', { name: new RegExp(`^${block.title} `) })).toBeVisible()
    await page.keyboard.press('Enter')
    // Type before waiting for a source popup: the first character must reach the new block.
    await page.keyboard.type(block.text)
    const inserted = body.locator(`[data-content-type="${block.type}"]`)
    if (block.type === 'math' || block.type === 'mermaid') {
      await expect(inserted.locator('.bn-preview-with-source-popup')).toHaveAttribute('data-open', 'true')
      await expect(inserted.locator('code[aria-label]')).toBeVisible()
    }
    await expect(inserted.locator('.bn-inline-content')).toHaveText(block.text)
    await saved(page)
    await page.screenshot({ path: info.outputPath(`slash-${block.type}-immediate-input.png`) })
    const after = await persistedLinkDocument(page)
    expect(after.document.blocks).toEqual([
      {
        id: before.document.blocks[0]?.id,
        type: block.type,
        props: block.props,
        content: [
          { type: 'text', text: block.text, styles: {} },
        ],
        children: [],
      },
    ])
    await page.reload()
    await expect(body.locator(`[data-content-type="${block.type}"] .bn-inline-content`)).toHaveText(block.text)
    expect((await persistedLinkDocument(page)).document).toEqual(after.document)
  })
}

const tocDescription = 'a custom slash TOC replaces its paragraph and continues typing in a new native paragraph'
test(tocDescription, async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 740 })
  const document = fixture('')
  document.meta.title = 'Slash TOC insertion'
  await writeDocument(page, document)
  const before = await persistedLinkDocument(page)
  const body = page.getByLabel('Document body', { exact: true })
  await body.focus()
  await page.keyboard.type('/toc')
  await expect(page.getByRole('option', { name: /^Table of contents / })).toBeVisible()
  await page.keyboard.press('Enter')
  await page.keyboard.type('After the contents')
  await expect(body.locator('[data-content-type="paragraph"] .bn-inline-content')).toHaveText('After the contents')
  await saved(page)
  const after = await persistedLinkDocument(page)
  expect(after.document.blocks).toEqual([
    { id: before.document.blocks[0]?.id, type: 'toc', props: { title: 'Contents' }, children: [] },
    {
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      type: 'paragraph',
      props: { textAlignment: 'left', textColor: 'default', backgroundColor: 'default' },
      content: [
        { type: 'text', text: 'After the contents', styles: {} },
      ],
      children: [],
    },
  ])
  expect(after.document.blocks[1]?.id).not.toBe(before.document.blocks[0]?.id)
  await page.screenshot({ path: info.outputPath('slash-toc-successor-input.png') })
  await page.reload()
  await expect(body.locator('[data-content-type="toc"]')).toBeVisible()
  await expect(body.locator('[data-content-type="paragraph"] .bn-inline-content')).toHaveText('After the contents')
  expect((await persistedLinkDocument(page)).document).toEqual(after.document)
})
