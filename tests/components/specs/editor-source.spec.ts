import type { Locator } from '@playwright/test'
import {
  expectSavedSource,
  openSourceWorkspace,
  selectSourceBlock,
  sourceText,
} from '../support/editor-source-fixtures'
import { expect, test } from '../support/test'

const edit = { math: 'Edit formula', mermaid: 'Edit diagram' } as const

function sourceField(block: Locator): Locator {
  return block.locator('code[role="textbox"]')
}

async function sourceCaretOffset(field: Locator): Promise<number> {
  return await field.evaluate((element) => {
    const selection = window.getSelection()
    const anchor = selection?.anchorNode ?? null
    if (selection === null || anchor === null || selection.rangeCount === 0 || !element.contains(anchor)) {
      return -1
    }
    const range = document.createRange()
    range.selectNodeContents(element)
    range.setEnd(anchor, selection.anchorOffset)
    return range.toString().length
  })
}

for (const kind of ['math', 'mermaid'] as const) {
  test(`${kind} Enter enters source text before the next Enter inserts a line`, async ({ page }) => {
    const { api, body } = await openSourceWorkspace(page, kind)
    try {
      const block = body.locator(`[data-content-type="${kind}"]`)
      await expect(block.locator('.bn-preview-with-source-popup')).toHaveAttribute('data-open', 'false')
      await selectSourceBlock(page, body)
      await page.keyboard.press('Enter')
      await expect(block.locator('.bn-preview-with-source-popup')).toHaveAttribute('data-open', 'true')
      expect(await sourceField(block).evaluate(element =>
        element.contains(window.getSelection()?.anchorNode ?? null))).toBe(true)
      await page.keyboard.press('Enter')
      await page.keyboard.type('q')
      await expect(sourceField(block)).toHaveText(`${sourceText[kind]}\nq`)
      await expectSavedSource(api, kind, `${sourceText[kind]}\nq`)
      await page.keyboard.press('ControlOrMeta+z')
      await expect(block).toBeVisible()
      await expect(body).toContainText('Keep this paragraph')
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })

  test(`${kind} typing on a selected source preserves every character and the block`, async ({ page }) => {
    const { api, body } = await openSourceWorkspace(page, kind)
    try {
      const block = body.locator(`[data-content-type="${kind}"]`)
      await expect(block.locator('.bn-preview-with-source-popup')).toHaveAttribute('data-open', 'false')
      await selectSourceBlock(page, body)
      await page.keyboard.type('+q')
      await expect(block).toBeVisible()
      await expect(block.locator('.bn-preview-with-source-popup')).toHaveAttribute('data-open', 'true')
      await expect(sourceField(block)).toHaveText(`${sourceText[kind]}+q`)
      await expect(body.locator('[data-content-type="paragraph"]')).toHaveText('Keep this paragraph')
      await expectSavedSource(api, kind, `${sourceText[kind]}+q`)
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })

  test(`${kind} text insertion without keydown keeps its selected node`, async ({ page }) => {
    const { api, body } = await openSourceWorkspace(page, kind)
    try {
      const block = body.locator(`[data-content-type="${kind}"]`)
      await expect(block.locator('.bn-preview-with-source-popup')).toHaveAttribute('data-open', 'false')
      await selectSourceBlock(page, body)
      await page.keyboard.insertText('汉')
      await expect(sourceField(block)).toHaveText(`${sourceText[kind]}汉`)
      await expectSavedSource(api, kind, `${sourceText[kind]}汉`)
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })

  test(`${kind} composition starts inside source and keeps its range`, async ({ page }) => {
    const { api, body } = await openSourceWorkspace(page, kind)
    try {
      const block = body.locator(`[data-content-type="${kind}"]`)
      await expect(block.locator('.bn-preview-with-source-popup')).toHaveAttribute('data-open', 'false')
      await selectSourceBlock(page, body)
      const prevented = await body.evaluate((element) => {
        const event = new CompositionEvent('compositionstart', { bubbles: true, cancelable: true })
        element.dispatchEvent(event)
        return event.defaultPrevented
      })
      expect(prevented).toBe(false)
      expect(await sourceField(block).evaluate(element =>
        element.contains(window.getSelection()?.anchorNode ?? null))).toBe(true)
      await body.dispatchEvent('keydown', { key: 'Enter', isComposing: true })
      await page.keyboard.insertText('汉')
      await body.dispatchEvent('compositionend', { data: '汉' })
      await expectSavedSource(api, kind, `${sourceText[kind]}汉`)
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}

test('reverse cross-block selection keeps Mod+A at document scope', async ({ page }) => {
  const { api, body } = await openSourceWorkspace(page, 'math', 'around')
  try {
    await body.getByRole('button', { name: edit.math, exact: true }).click()
    await expect(page.locator('[data-content-type="math"] .bn-preview-with-source-popup'))
      .toHaveAttribute('data-open', 'true')
    // The range is injected through the DOM, so the editor has to own keyboard focus first: the
    // open control lives outside the editor DOM, and ProseMirror neither commits a DOM selection
    // nor writes its own back while it does not own focus.
    await body.focus()
    await expect.poll(async () => await page.evaluate(() =>
      Boolean(document.activeElement?.closest('.ProseMirror')))).toBe(true)
    await body.evaluate((element) => {
      const source = element.querySelector('[data-content-type="math"] code')
      const paragraph = element.querySelector('[data-content-type="paragraph"] .bn-inline-content')
      if (source === null || paragraph === null) {
        throw new Error('Missing cross-block selection')
      }
      const anchor = document.createTreeWalker(source, NodeFilter.SHOW_TEXT).nextNode()
      const focus = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT).nextNode()
      if (anchor === null || focus === null) {
        throw new Error('Missing cross-block text')
      }
      window.getSelection()?.setBaseAndExtent(anchor, 3, focus, 2)
      document.dispatchEvent(new Event('selectionchange'))
    })
    await expect.poll(async () => await page.evaluate(() => window.getSelection()?.toString()))
      .toContain('this paragraph')
    await page.keyboard.press('ControlOrMeta+a')
    const selected = await page.evaluate(() => window.getSelection()?.toString())
    expect(selected).toContain('Keep this paragraph')
    expect(selected).toContain('After source')
    // Widening the selection never leaves an edit behind: nothing is written at all.
    expect(api.calls.filter(call => call.method !== 'GET')).toEqual([])
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

test('a lone source closes without hidden editing', async ({ page }) => {
  const { api, body } = await openSourceWorkspace(page, 'math', 'lone')
  try {
    const block = body.locator('[data-content-type="math"]')
    await block.getByRole('button', { name: edit.math, exact: true }).click()
    await block.getByRole('button', { name: 'Done', exact: true }).click()
    await expect(body).toBeFocused()
    await page.keyboard.type('After source')
    await expect(body.locator('[data-content-type="paragraph"]')).toHaveText('After source')
    await expect(sourceField(block)).toHaveText(sourceText.math)
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

for (const kind of ['math', 'mermaid'] as const) {
  test(`${kind} paste into a node-selected source keeps its plain text`, async ({ page }) => {
    const { api, body } = await openSourceWorkspace(page, kind)
    try {
      const block = body.locator(`[data-content-type="${kind}"]`)
      await expect(block.locator('.bn-preview-with-source-popup')).toHaveAttribute('data-open', 'false')
      await selectSourceBlock(page, body)
      const inserted = kind === 'math' ? '\ny=2\nz=3' : '\nB-->C\nC-->D'
      await body.evaluate((element, text) => {
        const clipboardData = new DataTransfer()
        clipboardData.setData('text/plain', text)
        clipboardData.setData('text/html', '<p>HTML must not create a block</p><p>Another block</p>')
        element.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData }))
      }, inserted)
      await expect(sourceField(block)).toHaveText(sourceText[kind] + inserted)
      await expectSavedSource(api, kind, sourceText[kind] + inserted)
      await expect(body.locator('[data-content-type="paragraph"]')).toHaveCount(1)
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}

test('mermaid Delete at the end of its source keeps the following paragraph', async ({ page }) => {
  const { api, body } = await openSourceWorkspace(page, 'mermaid')
  try {
    const block = body.locator('[data-content-type="mermaid"]')
    await block.getByRole('button', { name: edit.mermaid, exact: true }).click()
    await expect(block.locator('.bn-preview-with-source-popup')).toHaveAttribute('data-open', 'true')
    await expect.poll(async () => await sourceCaretOffset(sourceField(block)))
      .toBe(sourceText.mermaid.length)
    await body.evaluate((element) => {
      const recordDefault = (event: KeyboardEvent): void => {
        if (event.key === 'Delete') {
          Object.assign(element, { sourceDeleteEvent: event })
        }
      }
      window.addEventListener('keydown', recordDefault, { capture: true, once: true })
    })

    await page.keyboard.press('Delete')
    // Read only after native dispatch completes: a capture-listener microtask
    // can run before the editor's listener has cancelled the event.
    expect(await body.evaluate((element) => {
      const observed: unknown = Reflect.get(element, 'sourceDeleteEvent')
      return observed instanceof KeyboardEvent ? observed.defaultPrevented : null
    })).toBe(true)
    await expect(sourceField(block)).toHaveText(sourceText.mermaid)
    await expect(body.locator('[data-content-type="paragraph"]')).toHaveText('Keep this paragraph')
    expect(api.calls.filter(call => call.method === 'PUT' && call.path.endsWith('/revisions'))).toEqual([])
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})
