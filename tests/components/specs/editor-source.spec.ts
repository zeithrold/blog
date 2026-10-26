import type { Locator } from '@playwright/test'
import type { ApiCall } from '../support/http-fixtures'
import {
  expectSavedSource,
  openSourceWorkspace,
  selectSourceBlock,
  sourceText,
} from '../support/editor-source-fixtures'
import { apiKey } from '../support/http-fixtures'
import { expect, test } from '../support/test'

const edit = { math: 'Edit formula', mermaid: 'Edit diagram' } as const

const revisionRoute = 'PUT /api/admin/documents/:id/revisions'

function revisionWrites(api: { readonly calls: readonly ApiCall[] }): ApiCall[] {
  return api.calls.filter(call => apiKey(call.method, call.path) === revisionRoute)
}

function sourceField(block: Locator): Locator {
  return block.locator('code[role="textbox"]')
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

  test(`${kind} beforeinput deletion and line breaks respect source boundaries`, async ({ page }) => {
    const { api, body } = await openSourceWorkspace(page, kind)
    try {
      const block = body.locator(`[data-content-type="${kind}"]`)
      await expect(block.locator('.bn-preview-with-source-popup')).toHaveAttribute('data-open', 'false')
      await block.getByRole('button', { name: edit[kind], exact: true }).click()
      const send = async (inputType: string): Promise<boolean> => await body.evaluate((element, operation) => {
        const event = new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: operation })
        element.dispatchEvent(event)
        return event.defaultPrevented
      }, inputType)
      expect(await send('deleteContentForward')).toBe(true)
      await expect(sourceField(block)).toHaveText(sourceText[kind])
      expect(await send('insertParagraph')).toBe(true)
      await expect(sourceField(block)).toHaveText(`${sourceText[kind]}\n`)
      await expect(body).toContainText('Keep this paragraph')
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}

for (const kind of ['math', 'mermaid'] as const) {
  test(`${kind} rich clipboard becomes source text without creating a block`, async ({ page }) => {
    const { api, body } = await openSourceWorkspace(page, kind)
    try {
      const block = body.locator(`[data-content-type="${kind}"]`)
      await expect(block.locator('.bn-preview-with-source-popup')).toHaveAttribute('data-open', 'false')
      await block.getByRole('button', { name: edit[kind], exact: true }).click()
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
    await expect(block.locator('.bn-preview-with-source-popup')).toHaveAttribute('data-open', 'false')
    await expect(body).toBeFocused()
    await page.keyboard.type('After source')
    await expect(body.locator('[data-content-type="paragraph"]')).toHaveText('After source')
    await expect(sourceField(block)).toHaveText(sourceText.math)
    await expectSavedSource(api, 'math', sourceText.math)
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

  test(`${kind} Delete at the end of its source keeps the following paragraph`, async ({ page }) => {
    const { api, body } = await openSourceWorkspace(page, kind)
    try {
      const block = body.locator(`[data-content-type="${kind}"]`)
      await block.getByRole('button', { name: edit[kind], exact: true }).click()
      await expect(block.locator('.bn-preview-with-source-popup')).toHaveAttribute('data-open', 'true')
      await expect(body).toBeFocused()
      await page.keyboard.press('Delete')
      await expect(body.locator('[data-content-type="paragraph"]')).toHaveText('Keep this paragraph')
      await expect(sourceField(block)).toHaveText(sourceText[kind])
      // A delete at the source boundary changes nothing, so no revision packet leaves the client.
      expect(revisionWrites(api)).toEqual([])
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}

test('a lone source closes without hidden editing while publication locked', async ({ page }) => {
  let release = (): void => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const { api, body } = await openSourceWorkspace(page, 'math', 'lone', open => ({
    'POST /api/admin/documents/:id/publish': async () => {
      await gate
      return {
        body: {
          documentId: open.documentId,
          version: open.version,
          headRevisionId: open.headRevisionId,
          liveRevisionId: open.headRevisionId,
          liveGeneration: 1,
        },
      }
    },
  }))
  try {
    const block = body.locator('[data-content-type="math"]')
    await block.getByRole('button', { name: edit.math, exact: true }).click()
    await page.getByRole('button', { name: 'Publish', exact: true }).click()
    await expect(body).toHaveAttribute('contenteditable', 'false')
    await block.getByRole('button', { name: 'Done', exact: true }).click()
    await expect(block.locator('.bn-preview-with-source-popup')).toHaveAttribute('data-open', 'false')
    // Closing the editor while the publish request is held still edits nothing.
    expect(revisionWrites(api)).toEqual([])
    await expect(sourceField(block)).toHaveText(sourceText.math)
    release()
    await expect(body).toHaveAttribute('contenteditable', 'true')
    await api.expectServed()
  }
  finally {
    release()
    await api.dispose()
  }
})
