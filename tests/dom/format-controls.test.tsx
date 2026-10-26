/* eslint-disable max-lines -- Keep the real toolbar, drawer and command behavior in one DOM contract batch. */
import { act } from 'react'
import { expect, it } from 'vitest'
import { saveSchema } from '@/contracts/documents'
import { paragraphBlock } from '~/tests/components/support/editor-workspace-fixtures'
import { all, button, click, field, one, typeText } from './dom'
import { drainHostTask, setMediaState, until } from './environment'
import {
  mountFormattingEditor,
  selectedFormatText,
  selectFormatRange,
} from './format-support'

const selected = 'Selected phrase'
const suffix = ' untouched suffix'
const text = `${selected}${suffix}`
const formattingUrl = 'https://example.com/formatting'

function toolbar(locale: 'en' | 'zh-CN' = 'en'): HTMLElement {
  const label = locale === 'en' ? 'Formatting' : '文字格式'
  const found = all<HTMLElement>(document.body, '[role="toolbar"]')
    .find(element => element.getAttribute('aria-label') === label)
  if (found === undefined) {
    throw new Error(`The ${label} toolbar has not rendered`)
  }
  return found
}

function action(root: ParentNode, label: string): HTMLButtonElement {
  const found = all<HTMLButtonElement>(root, 'button')
    .find(element => element.getAttribute('aria-label') === label
      || element.textContent.replaceAll(/\s+/g, ' ').trim() === label)
  if (found === undefined) {
    throw new Error(`The "${label}" formatting control is missing`)
  }
  return found
}

async function actUntil(run: () => void, condition: () => boolean): Promise<void> {
  await act(async () => {
    run()
    await until(condition)
  })
}

async function actAndDrain(run: () => void): Promise<void> {
  await act(async () => {
    run()
    await drainHostTask()
    await drainHostTask()
  })
}

function formattingCopy(locale: 'en' | 'zh-CN') {
  return locale === 'en'
    ? {
        toolbar: 'Formatting',
        body: 'Document body',
        blockType: 'Block type',
        bold: 'Bold',
        italic: 'Italic',
        underline: 'Underline',
        more: 'More formatting options',
        drawer: 'Formatting options',
        strike: 'Strike',
        colors: 'Colors',
        link: 'Create link',
        center: 'Align text center',
        nest: 'Nest block',
        unnest: 'Unnest block',
      }
    : {
        toolbar: '文字格式',
        body: '正文',
        blockType: '块类型',
        bold: '加粗',
        italic: '斜体',
        underline: '下划线',
        more: '更多格式选项',
        drawer: '格式选项',
        strike: '删除线',
        colors: '颜色',
        link: '添加链接',
        center: '居中',
        nest: '嵌套',
        unnest: '取消嵌套',
      }
}

async function waitForToolbar(locale: 'en' | 'zh-CN' = 'en'): Promise<HTMLElement> {
  await until(() => document.body.querySelector('[role="toolbar"]') !== null)
  return toolbar(locale)
}

async function openAdvanced(locale: 'en' | 'zh-CN' = 'en'): Promise<HTMLElement> {
  const more = locale === 'en' ? 'More formatting options' : '更多格式选项'
  const bar = await waitForToolbar(locale)
  await actUntil(
    () => click(action(bar, more)),
    () => document.body.querySelector('.formatting-options-drawer[role="dialog"]') !== null,
  )
  const drawer = document.body.querySelector<HTMLElement>('.formatting-options-drawer[role="dialog"]')
  if (drawer === null) {
    throw new Error('The formatting options drawer did not render')
  }
  return drawer
}

function revisionWrite(view: Awaited<ReturnType<typeof mountFormattingEditor>>): {
  method: string
  path: string
  json: unknown
} {
  const write = view.api.calls.find(call => call.method === 'PUT')
  if (write === undefined) {
    throw new Error('The formatting action sent no revision request')
  }
  return write
}

function editorSurface(view: Awaited<ReturnType<typeof mountFormattingEditor>>): HTMLElement {
  const element = view.editor.domElement
  if (element === undefined) {
    throw new Error('The formatting editor has no DOM surface')
  }
  return element
}

function textAlignment(view: Awaited<ReturnType<typeof mountFormattingEditor>>): string | undefined {
  const props = view.editor.document[0]?.props
  return props !== undefined && 'textAlignment' in props ? props.textAlignment : undefined
}

function hasStrike(view: Awaited<ReturnType<typeof mountFormattingEditor>>): boolean {
  const content = view.editor.document[0]?.content
  if (!Array.isArray(content)) {
    return false
  }
  const first = content[0]
  return first !== undefined && 'styles' in first && first.styles.strike === true
}

function hasBold(view: Awaited<ReturnType<typeof mountFormattingEditor>>): boolean {
  const content = view.editor.document[0]?.content
  if (!Array.isArray(content)) {
    return false
  }
  const first = content[0]
  return first !== undefined && 'styles' in first && first.styles.bold === true
}

function hasSingleTextRun(view: Awaited<ReturnType<typeof mountFormattingEditor>>): boolean {
  const content = view.editor.document[0]?.content
  return Array.isArray(content) && content.length === 1
}

it('the real Bold control marks only the selected range, saves it, and undo restores plain text', async () => {
  const view = mountFormattingEditor()
  await selectFormatRange(view, 0, selected.length)
  const bar = await waitForToolbar()
  await actUntil(() => click(action(bar, 'Bold')), () => hasBold(view))

  expect(selectedFormatText(view)).toBe(selected)
  expect(view.editor.document[0]?.content).toEqual([
    { type: 'text', text: selected, styles: { bold: true } },
    { type: 'text', text: suffix, styles: {} },
  ])
  expect(view.api.calls.filter(call => call.method === 'PUT')).toEqual([])

  await view.flush()
  const write = revisionWrite(view)
  const packet = saveSchema.parse(write.json)
  expect(write.method).toBe('PUT')
  expect(write.path).toBe(`/api/admin/documents/${view.initial.documentId}/revisions`)
  expect(packet).toMatchObject({
    expectedVersion: view.initial.version,
    baseRevisionId: view.initial.headRevisionId,
    reason: 'autosave',
    document: {
      blocks: [
        {
          content: [
            { type: 'text', text: selected, styles: { bold: true } },
            { type: 'text', text: suffix, styles: {} },
          ],
        },
      ],
    },
  })

  const editorDom = editorSurface(view)
  await actUntil(() => {
    editorDom.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'z',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    }))
  }, () => hasSingleTextRun(view))
  expect(view.editor.document[0]?.content).toEqual([
    { type: 'text', text, styles: {} },
  ])
})

it('the real color matrix applies and marks both colors on only the selected range', async () => {
  const view = mountFormattingEditor({ width: 390 })
  await selectFormatRange(view, 0, selected.length)
  const drawer = await openAdvanced()
  await actUntil(
    () => click(action(drawer, 'Colors')),
    () => document.body.querySelector('[role="dialog"] [data-color-kind="text"]') !== null,
  )

  const colors = document.body
    .querySelector<HTMLElement>('[role="dialog"] [data-color-kind="text"]')
    ?.closest('[role="dialog"]')
  if (colors === null || colors === undefined) {
    throw new Error('The formatting color matrix did not render')
  }
  const textColors = one(colors, '[data-color-kind="text"]')
  const backgrounds = one(colors, '[data-color-kind="background"]')
  expect(all(textColors, 'button')).toHaveLength(10)
  expect(all(backgrounds, 'button')).toHaveLength(10)

  const blue = one<HTMLButtonElement>(textColors, '[data-test="text-color-blue"]')
  const yellow = one<HTMLButtonElement>(backgrounds, '[data-test="background-color-yellow"]')
  await actUntil(() => click(blue), () => blue.getAttribute('aria-pressed') === 'true')
  await actUntil(() => click(yellow), () => yellow.getAttribute('aria-pressed') === 'true')
  expect(blue.getAttribute('aria-pressed')).toBe('true')
  expect(yellow.getAttribute('aria-pressed')).toBe('true')
  expect(view.editor.document[0]?.content).toEqual([
    { type: 'text', text: selected, styles: { textColor: 'blue', backgroundColor: 'yellow' } },
    { type: 'text', text: suffix, styles: {} },
  ])

  await view.flush()
  expect(saveSchema.parse(revisionWrite(view).json).document).toMatchObject({
    blocks: [
      {
        content: [
          { type: 'text', text: selected, styles: { textColor: 'blue', backgroundColor: 'yellow' } },
          { type: 'text', text: suffix, styles: {} },
        ],
      },
    ],
  })
})

for (const locale of ['en', 'zh-CN'] as const) {
  it(`the real toolbar and advanced actions use ${locale} copy in compact and wide modes`, async () => {
    const copy = formattingCopy(locale)
    const view = mountFormattingEditor({ locale, width: 700 })
    await selectFormatRange(view, 0, selected.length)
    const compactToolbar = await waitForToolbar(locale)
    expect(compactToolbar.getAttribute('aria-label')).toBe(copy.toolbar)
    for (const label of [
      copy.blockType,
      copy.bold,
      copy.italic,
      copy.underline,
      copy.more,
    ]) {
      expect(action(compactToolbar, label)).toBeDefined()
    }
    expect(all(compactToolbar, 'button')).toHaveLength(5)
    expect(compactToolbar.querySelector(`[aria-label="${copy.strike}"]`)).toBeNull()

    const drawer = await openAdvanced(locale)
    expect(drawer.textContent).toContain(copy.drawer)
    expect(drawer.querySelector('[data-vaul-handle]')).not.toBeNull()
    for (const label of [
      copy.strike,
      copy.colors,
      copy.link,
      copy.center,
      copy.nest,
      copy.unnest,
    ]) {
      expect(action(drawer, label)).toBeDefined()
    }

    setMediaState({ width: 701 })
    await drainHostTask()
    await until(() => document.body.querySelector('.formatting-options-drawer[role="dialog"]') === null)
    const wideToolbar = await waitForToolbar(locale)
    expect(wideToolbar.querySelector(`[aria-label="${copy.more}"]`)).toBeNull()
    expect(action(wideToolbar, copy.strike)).toBeDefined()
    expect(action(wideToolbar, copy.colors)).toBeDefined()
    expect(action(wideToolbar, copy.link)).toBeDefined()
    expect(view.container.querySelector(`[aria-label="${copy.body}"]`)).not.toBeNull()
    await view.api.expectServed()
  })
}

it('the advanced toolbar applies Strike, centers the block, and nests then unnests a block', async () => {
  const blocks = [
    paragraphBlock(text),
    paragraphBlock('Second block'),
  ]
  const view = mountFormattingEditor({ blocks, width: 390 })
  await selectFormatRange(view, 0, selected.length)
  let drawer = await openAdvanced()
  await actUntil(() => click(action(drawer, 'Strike')), () => hasStrike(view))
  expect(view.editor.document[0]?.content).toEqual([
    { type: 'text', text: selected, styles: { strike: true } },
    { type: 'text', text: suffix, styles: {} },
  ])

  drawer = await openAdvanced()
  await actUntil(
    () => click(action(drawer, 'Align text center')),
    () => textAlignment(view) === 'center',
  )
  expect(textAlignment(view)).toBe('center')

  await selectFormatRange(view, 0, 'Second block'.length, 1)
  drawer = await openAdvanced()
  await actUntil(() => click(action(drawer, 'Nest block')), () => view.editor.document[0]?.children.length === 1)
  expect(view.editor.document).toHaveLength(1)
  expect(view.editor.document[0]?.children[0]?.content).toEqual([
    {
      type: 'text',
      text: 'Second block',
      styles: {},
    },
  ])

  drawer = await openAdvanced()
  await actUntil(() => click(action(drawer, 'Unnest block')), () => view.editor.document.length === 2)
  expect(view.editor.document.map(block => block.type)).toEqual(['paragraph', 'paragraph'])
  await view.flush()
  expect(saveSchema.parse(revisionWrite(view).json).document).toMatchObject({
    blocks: [
      {
        props: { textAlignment: 'center' },
        content: [
          { type: 'text', text: selected, styles: { strike: true } },
          { type: 'text', text: suffix, styles: {} },
        ],
      },
      {
        content: [
          { type: 'text', text: 'Second block', styles: {} },
        ],
      },
    ],
  })
})

it('the real Create link action saves the selected text with its requested destination', async () => {
  const view = mountFormattingEditor({ width: 1440 })
  await selectFormatRange(view, 0, selected.length)
  const bar = await waitForToolbar()
  await actAndDrain(() => click(action(bar, 'Create link')))
  await until(() => document.body.querySelector('[role="dialog"] input') !== null)
  const dialog = one(document.body, '[role="dialog"]')
  const url = field(dialog, 'Edit URL')
  await act(async () => {
    typeText(url, formattingUrl)
    await drainHostTask()
  })
  await actAndDrain(() => click(button(dialog, 'Save')))
  await until(() => view.container.querySelector(`a[href="${formattingUrl}"]`) !== null)
  expect(view.editor.document[0]?.content).toEqual([
    {
      type: 'link',
      href: formattingUrl,
      content: [
        { type: 'text', text: selected, styles: {} },
      ],
    },
    { type: 'text', text: suffix, styles: {} },
  ])

  await view.flush()
  expect(saveSchema.parse(revisionWrite(view).json).document).toMatchObject({
    blocks: [
      {
        content: [
          {
            type: 'link',
            href: formattingUrl,
            content: [
              { type: 'text', text: selected, styles: {} },
            ],
          },
          { type: 'text', text: suffix, styles: {} },
        ],
      },
    ],
  })
  await until(() => document.body.querySelector('.editor-link-command[role="dialog"]') === null)
  await drainHostTask()
})

it('the real toolbar opens for an editable selection, closes when disabled, and returns when enabled', async () => {
  const view = mountFormattingEditor({ width: 390 })
  await selectFormatRange(view, 0, selected.length)
  const bar = await waitForToolbar()
  await actUntil(
    () => click(action(bar, 'More formatting options')),
    () => document.body.querySelector('.formatting-options-drawer[role="dialog"]') !== null,
  )

  const editor = editorSurface(view)
  await actAndDrain(() => view.state().setDisabled(true))
  await until(() => document.body.querySelector('.formatting-options-drawer[role="dialog"]') === null
    && editor.getAttribute('contenteditable') === 'false')
  const disabledToolbar = await waitForToolbar()
  await act(async () => {
    click(action(disabledToolbar, 'More formatting options'))
    await drainHostTask()
  })
  expect(document.body.querySelector('.formatting-options-drawer[role="dialog"]')).toBeNull()

  await actAndDrain(() => view.state().setDisabled(false))
  await until(() => editor.getAttribute('contenteditable') === 'true')
  await selectFormatRange(view, 0, selected.length)
  const enabledToolbar = await waitForToolbar()
  await actUntil(
    () => click(action(enabledToolbar, 'More formatting options')),
    () => document.body.querySelector('.formatting-options-drawer[role="dialog"]') !== null,
  )
  expect(view.api.calls.filter(call => call.method === 'PUT')).toEqual([])
})

it('selecting a range shows the real toolbar without saving a draft', async () => {
  const view = mountFormattingEditor()
  expect(document.body.querySelector('[role="toolbar"]')).toBeNull()
  await selectFormatRange(view, 0, selected.length)
  await waitForToolbar()
  expect(selectedFormatText(view)).toBe(selected)
  expect(view.api.calls.filter(call => call.method === 'PUT')).toEqual([])
  await view.api.expectServed()
})

it('the real options drawer closes at the breakpoint and the editor model keeps its selection', async () => {
  const view = mountFormattingEditor({ width: 700 })
  const editorDom = editorSurface(view)
  await selectFormatRange(view, 0, selected.length)
  const drawer = await openAdvanced()
  expect(drawer).toBeDefined()

  setMediaState({ width: 701 })
  await drainHostTask()
  await until(() => document.body.querySelector('.formatting-options-drawer[role="dialog"]') === null)
  expect(selectedFormatText(view)).toBe(selected)

  setMediaState({ width: 700 })
  await drainHostTask()
  await waitForToolbar()
  expect(selectedFormatText(view)).toBe(selected)
  expect(view.editor.domElement).toBe(editorDom)
  expect(editorDom.isConnected).toBe(true)
  await view.api.expectServed()
})

it('Escape closes the real floating toolbar and keeps the editor model selection', async () => {
  const view = mountFormattingEditor()
  await actAndDrain(() => view.editor.focus())
  await selectFormatRange(view, 0, selected.length)
  const bar = await waitForToolbar()

  await actAndDrain(() => {
    bar.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    }))
  })
  await until(() => document.body.querySelector('[role="toolbar"]') === null)

  expect(selectedFormatText(view)).toBe(selected)
  expect(view.api.calls.filter(call => call.method === 'PUT')).toEqual([])
  await view.api.expectServed()
})
