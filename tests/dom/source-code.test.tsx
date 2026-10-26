import { act } from 'react'
import { expect, it } from 'vitest'
import { one, selectNative } from './dom'
import { until } from './environment'
import {
  blockId,
  codeDocument,
  codeText,
  flushSourceDraft,
  mountSourceEditor,
  savedDocument,
} from './source-support'

function codeControl(view: Awaited<ReturnType<typeof mountSourceEditor>>): HTMLSelectElement {
  return one<HTMLSelectElement>(view.container, 'select[aria-label="Code language"]')
}

function codeElement(view: Awaited<ReturnType<typeof mountSourceEditor>>): HTMLElement {
  return one<HTMLElement>(view.container, '[data-content-type="codeBlock"] pre code')
}

function blockLanguage(view: Awaited<ReturnType<typeof mountSourceEditor>>): string | undefined {
  const block = view.editor.getBlock(blockId(view, 'codeBlock'))
  return block?.type === 'codeBlock' ? block.props.language : undefined
}

function savedCode(view: Awaited<ReturnType<typeof mountSourceEditor>>): {
  language: unknown
  source: string
} {
  const block = savedDocument(view).blocks.find(item => item.type === 'codeBlock')
  if (block === undefined || !Array.isArray(block.content)) {
    throw new Error('The revision packet has no code block')
  }
  return {
    language: block.props.language,
    source: block.content.map(item => 'text' in item ? item.text : '').join(''),
  }
}

it('the real code highlighter renders tokens while preserving the selected language and source', async () => {
  const view = await mountSourceEditor(codeDocument('python'))
  try {
    await until(() => codeElement(view).querySelectorAll('.shiki').length > 2)
    expect(codeControl(view).value).toBe('python')
    expect(codeElement(view).textContent).toBe(codeText)
    expect(blockLanguage(view)).toBe('python')
  }
  finally {
    view.unmount()
  }
})

for (const width of [1440, 390]) {
  it(`the code language select updates the real block and saves its source at ${width}px`, async () => {
    const view = await mountSourceEditor(codeDocument(), { width })
    try {
      const selector = codeControl(view)
      expect(selector.classList.contains('code-language-select')).toBe(true)
      expect(selector.value).toBe('text')

      act(() => selectNative(selector, 'python'))
      expect(selector.value).toBe('python')
      expect(blockLanguage(view)).toBe('python')
      expect(codeElement(view).textContent).toBe(codeText)

      await flushSourceDraft(view)
      expect(savedCode(view)).toEqual({ language: 'python', source: codeText })
    }
    finally {
      view.unmount()
    }
  })
}

it('an unknown saved code language remains listed until the author selects another', async () => {
  const view = await mountSourceEditor(codeDocument('legacy-lang'))
  try {
    const selector = codeControl(view)
    expect(selector.value).toBe('legacy-lang')
    expect(Array.from(selector.options).some(option => option.value === 'legacy-lang')).toBe(true)
    expect(codeElement(view).querySelectorAll('.shiki')).toHaveLength(0)

    act(() => selectNative(selector, 'ruby'))
    await until(() => codeElement(view).querySelectorAll('.shiki').length > 0)
    expect(selector.value).toBe('ruby')
    expect(codeElement(view).textContent).toBe(codeText)
    expect(blockLanguage(view)).toBe('ruby')

    await flushSourceDraft(view)
    expect(savedCode(view)).toEqual({ language: 'ruby', source: codeText })
  }
  finally {
    view.unmount()
  }
})

it('plain text removes syntax tokens and Python restores them without changing the source', async () => {
  const view = await mountSourceEditor(codeDocument('python'))
  try {
    await until(() => codeElement(view).querySelectorAll('.shiki').length > 0)
    const selector = codeControl(view)

    act(() => selectNative(selector, 'text'))
    await until(() => codeElement(view).querySelectorAll('.shiki').length === 0)
    expect(codeElement(view).textContent).toBe(codeText)

    act(() => selectNative(selector, 'python'))
    await until(() => codeElement(view).querySelectorAll('.shiki').length > 0)
    expect(codeElement(view).textContent).toBe(codeText)
    expect(blockLanguage(view)).toBe('python')

    await flushSourceDraft(view)
    expect(savedCode(view)).toEqual({ language: 'python', source: codeText })
  }
  finally {
    view.unmount()
  }
})
