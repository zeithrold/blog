import { act } from 'react'
import { expect, it } from 'vitest'
import { button, click, field, one, typeText } from './dom'
import { until } from './environment'
import {
  blockId,
  editorElement,
  flushSourceDraft,
  formulaDocument,
  mountSourceEditor,
  savedDocument,
} from './source-support'

const inlineSource = 'a^2'

function savedInlineSource(view: Awaited<ReturnType<typeof mountSourceEditor>>): string {
  const content = savedDocument(view).blocks[0]?.content
  if (!Array.isArray(content)) {
    throw new TypeError('The saved paragraph has no inline content')
  }
  const formula = content.find(item => item.type === 'inlineMath')
  if (formula?.type !== 'inlineMath') {
    throw new TypeError('The revision packet has no inline formula')
  }
  return formula.props.source
}

function inlinePower(root: ParentNode): Element {
  const inline = root.querySelector('[data-inline-content-type="inlineMath"]')
  const power = inline?.querySelector('msup')
  if (power === null || power === undefined) {
    throw new TypeError('The inlineMath node has no rendered msup')
  }
  return power
}

function expectInlineMathA2(root: ParentNode): void {
  const power = inlinePower(root)
  expect(power.children).toHaveLength(2)
  expect(power.children[0]?.tagName.toLowerCase()).toBe('mi')
  expect(power.children[0]?.textContent).toBe('a')
  expect(power.children[1]?.tagName.toLowerCase()).toBe('mn')
  expect(power.children[1]?.textContent).toBe('2')
}

async function waitForDom(
  description: string,
  condition: () => boolean,
): Promise<void> {
  try {
    // Await the real lazy resource, not the DOM commit, inside act. Waiting
    // for rendered MathML there can prevent React from committing that resource.
    await act(async () => {
      await import('@/features/reader/math')
    })
    await until(condition)
  }
  catch (cause) {
    throw new Error(`The inline formula surface did not render ${description}`, { cause })
  }
}

for (const width of [1440, 390]) {
  it(`the Inline formula toolbar edits and saves its source at ${width}px`, async () => {
    const view = await mountSourceEditor(formulaDocument(), { width })
    try {
      act(() => {
        editorElement(view).focus()
        view.editor.setTextCursorPosition(blockId(view, 'paragraph'), 'end')
      })
      expect(view.editor.isFocused()).toBe(true)
      act(() => click(one(view.container, 'button[aria-label="Inline formula"]')))
      expect(JSON.stringify(view.editor.document)).toContain('inlineMath')
      await waitForDom('the Formula source input', () =>
        document.body.querySelectorAll('input').length > 0)

      const source = field(document.body, 'Formula source')
      await waitForDom('native focus on Formula source', () => document.activeElement === source)
      expect(source).toBe(document.activeElement)
      expect(source).toBeInstanceOf(HTMLInputElement)
      if (!(source instanceof HTMLInputElement)) {
        throw new TypeError('The formula source control is not an input')
      }
      act(() => typeText(source, inlineSource))
      expect(source.value).toBe(inlineSource)

      act(() => click(button(document.body, 'Done')))
      await waitForDom('the closed formula editor', () =>
        document.body.querySelector('[role="dialog"]') === null)
      await flushSourceDraft(view)
      expect(savedDocument(view).blocks[0]?.content).toEqual(expect.arrayContaining([
        expect.objectContaining({
          type: 'inlineMath',
          props: { source: inlineSource },
        }),
      ]))
      expect(savedInlineSource(view)).toBe(inlineSource)
      await waitForDom('the inline node’s MathML', () =>
        view.container.querySelector('[data-inline-content-type="inlineMath"] msup') !== null)
      expectInlineMathA2(view.container)
      expect(view.container.querySelector('[data-inline-content-type="inlineMath"] math msup > mi')?.textContent)
        .toBe('a')
      expect(view.container.querySelector('[data-inline-content-type="inlineMath"] math msup > mn')?.textContent)
        .toBe('2')
    }
    finally {
      view.unmount()
    }
  })
}

it('the inline MathML oracle rejects a stale source rendered by the real InlineMathView', async () => {
  const view = await mountSourceEditor(formulaDocument('a^3'))
  try {
    await waitForDom('the stale inline node’s MathML', () =>
      view.container.querySelector('[data-inline-content-type="inlineMath"] msup') !== null)
    const stale = inlinePower(view.container)
    expect(stale.children[0]?.textContent).toBe('a')
    expect(stale.children[1]?.textContent).toBe('3')
    expect(() => expectInlineMathA2(view.container)).toThrow()
  }
  finally {
    view.unmount()
  }
})
