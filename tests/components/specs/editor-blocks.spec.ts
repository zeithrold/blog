import {
  blockActions,
  blockText,
  dragBlock,
  expectPacketBlocks,
  openBlocksWorkspace,
  packetBlocks,
  paragraph,
  reveal,
} from '../support/editor-block-fixtures'
import { expect, test } from '../support/test'

const editableBlocks = [
  { type: 'callout', title: 'Callout', props: { tone: 'info' }, text: 'Immediate custom text', width: 390 },
  { type: 'footnote', title: 'Footnote', props: {}, text: 'Immediate footnote text', width: 1440 },
  { type: 'math', title: 'Formula', props: {}, text: 'a^2+b^2=c^2', width: 320 },
  { type: 'mermaid', title: 'Diagram', props: { description: '' }, text: 'graph TD; A-->B', width: 390 },
] as const

for (const block of editableBlocks) {
  test(`a custom slash ${block.type} replaces its empty paragraph and immediately accepts typing`, async ({ page }) => {
    await page.setViewportSize({ width: block.width, height: 740 })
    const { api, body } = await openBlocksWorkspace(page)
    try {
      await body.focus()
      await page.keyboard.type(`/${block.type}`)
      await expect(page.getByRole('option', { name: new RegExp(`^${block.title} `) })).toBeVisible()
      await page.keyboard.press('Enter')
      // Type before any source popup settles: the first character must reach the new block.
      await page.keyboard.type(block.text)
      const inserted = body.locator(`[data-content-type="${block.type}"]`)
      if (block.type === 'math' || block.type === 'mermaid') {
        await expect(inserted.locator('.bn-preview-with-source-popup')).toHaveAttribute('data-open', 'true')
        await expect(inserted.locator('code[aria-label]')).toBeVisible()
      }
      await expect(inserted.locator('.bn-inline-content')).toHaveText(block.text)
      // The empty paragraph became that block instead of keeping a paragraph beside it.
      await expectPacketBlocks(api, [
        { type: block.type, props: block.props, content: [
          { type: 'text', text: block.text, styles: {} },
        ] },
      ])
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}

test('a custom slash TOC replaces its paragraph and continues typing in a new native paragraph', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 740 })
  const { api, body } = await openBlocksWorkspace(page)
  try {
    await body.focus()
    await page.keyboard.type('/toc')
    await expect(page.getByRole('option', { name: /^Table of contents / })).toBeVisible()
    await page.keyboard.press('Enter')
    await page.keyboard.type('After the contents')
    await expect(body.locator('[data-content-type="paragraph"] .bn-inline-content')).toHaveText('After the contents')
    await expectPacketBlocks(api, [
      { type: 'toc', props: { title: 'Contents' }, content: undefined },
      {
        type: 'paragraph',
        props: { textAlignment: 'left', textColor: 'default', backgroundColor: 'default' },
        content: [
          { type: 'text', text: 'After the contents', styles: {} },
        ],
      },
    ])
    const blocks = packetBlocks(api) ?? []
    expect(blocks).toHaveLength(2)
    // The successor paragraph is a new block, never the paragraph the TOC replaced.
    expect(blocks[1]?.id).not.toBe(blocks[0]?.id)
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

test('slash commands keep keyboard selection visible and insert the selected native block', async ({ page }) => {
  const { api, body } = await openBlocksWorkspace(page)
  try {
    await body.press('/')
    const palette = page.getByRole('listbox', { name: 'Insert block', exact: true })
    const options = palette.getByRole('option')
    const selected = palette.getByRole('option', { selected: true })
    await expect(palette).toBeVisible()
    await expect(selected).toHaveCount(1)
    await expect(body).toBeFocused()
    await expect(body).toHaveAttribute('aria-controls', 'bn-suggestion-menu')
    await expect(body).toHaveAttribute('aria-activedescendant', await selected.getAttribute('id') ?? '')
    await body.press('PageDown')
    await expect(options.last()).toHaveAttribute('aria-selected', 'true')
    await expect.poll(async () => await selected.evaluate((element) => {
      const menu = element.closest('[role="listbox"]')
      if (menu === null) {
        return false
      }
      const box = element.getBoundingClientRect()
      const menuBox = menu.getBoundingClientRect()
      return box.top >= menuBox.top && box.bottom <= menuBox.bottom
    })).toBe(true)
    await expect(body).toBeFocused()
    await body.press('PageUp')
    await expect(options.first()).toHaveAttribute('aria-selected', 'true')
    await body.press('ArrowDown')
    await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true')
    await body.press('Enter')
    await expect(palette).toHaveCount(0)
    await expect(body.locator('.bn-block-content[data-content-type="heading"][data-level="2"]')).toBeVisible()
    await body.pressSequentially('Keyboard selected heading')
    await expect(body).toContainText('Keyboard selected heading')
    await page.setViewportSize({ width: 320, height: 740 })
    await body.press('Enter')
    await body.press('/')
    await expect(palette).toBeVisible()
    expect(await palette.evaluate((element) => {
      const box = element.getBoundingClientRect()
      return box.left >= 0 && box.right <= window.innerWidth
    })).toBe(true)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect(palette).toHaveCSS('animation-name', 'none')
    await body.press('Escape')
    await expect(palette).toHaveCount(0)
    await expect(body).toBeFocused()
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

test('the add control inserts a heading and the block menu deletes only that block', async ({ page }) => {
  const { api, body } = await openBlocksWorkspace(page, 3)
  try {
    const block = await reveal(page, 1)
    const add = page.getByRole('button', { name: 'Add block', exact: true })
    // Clicking outside the plus glyph must still perform the control's action.
    await add.click({ position: { x: 3, y: 3 } })
    const suggestions = page.getByRole('listbox', { name: 'Insert block', exact: true })
    await expect(suggestions).toBeVisible()
    await suggestions.getByRole('option', { name: /^Heading 1/ }).click()
    await body.pressSequentially('A heading inserted with the plus button')
    const heading = page.locator('.bn-block-content[data-content-type="heading"]')
    await expect(heading).toContainText('A heading inserted with the plus button')
    await expect(block).toBeVisible()
    await heading.hover()
    await page.getByRole('button', { name: 'Open block menu', exact: true }).click()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(heading).toHaveCount(0)
    await expect(paragraph(page, 1)).toBeVisible()
    await expect(paragraph(page, 2)).toBeVisible()
    await expect.poll(() => packetBlocks(api)?.filter(item => item.type === 'heading').length ?? -1).toBe(0)
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

test('block controls keep keyboard activation, menu order and native drag', async ({ page }) => {
  const { api } = await openBlocksWorkspace(page, 3)
  try {
    await reveal(page, 1)
    const add = page.getByRole('button', { name: 'Add block', exact: true })
    await add.focus()
    await add.press('Space')
    const suggestions = page.getByRole('listbox', { name: 'Insert block', exact: true })
    await expect(suggestions).toBeVisible()
    await page.keyboard.press('Enter')
    const heading = page.locator('.bn-block-content[data-content-type="heading"]')
    await expect(heading).toBeVisible()
    await page.getByLabel('Document body', { exact: true }).pressSequentially('Keyboard inserted heading')
    await heading.hover()
    const drag = page.getByRole('button', { name: 'Open block menu', exact: true })
    await drag.focus()
    await drag.press('Enter')
    const remove = page.getByRole('button', { name: 'Delete', exact: true })
    await expect(remove).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(heading).toHaveCount(0)
    await reveal(page, 1)
    await dragBlock(page, drag, paragraph(page, 3))
    await expect.poll(async () => {
      const text = await page.getByLabel('Document body', { exact: true }).innerText()
      return text.indexOf(blockText(1)) > text.indexOf(blockText(3))
    }).toBe(true)
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

test.describe('touch block actions', () => {
  test.use({ hasTouch: true })
  test('a touch tap opens the block drawer and deletes only its active block at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 })
    const { api, body } = await openBlocksWorkspace(page, 3)
    try {
      await paragraph(page, 1).tap()
      const handle = page.getByRole('button', { name: 'Open block menu', exact: true })
      await expect(handle).toBeVisible()
      await handle.tap()
      const menu = blockActions(page)
      await expect(menu).toBeVisible()
      await menu.getByRole('button', { name: 'Delete', exact: true }).tap()
      await expect(paragraph(page, 1)).toHaveCount(0)
      await expect(paragraph(page, 2)).toBeVisible()
      await expect(paragraph(page, 3)).toBeVisible()
      await expect(body).toBeVisible()
      await expect.poll(() => packetBlocks(api)?.length ?? -1).toBe(2)
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
})
