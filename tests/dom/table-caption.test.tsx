import { act } from 'react'
import { expect, it } from 'vitest'
import { all, click, field, one, press, typeText } from './dom'
import {
  firstTableId,
  mountTableSurface,
  revisionCount,
  saveTableDraft,
  secondTableId,
} from './table-support'

function captionWidgets(root: ParentNode): [HTMLElement, HTMLElement] {
  const found = all<HTMLElement>(root, '.table-caption-target')
  const first = found[0]
  const second = found[1]
  if (found.length !== 2 || first === undefined || second === undefined) {
    throw new Error(`Expected two table caption controls, found ${found.length}`)
  }
  return [first, second]
}

function userClick(element: Element): void {
  act(() => {
    click(element)
  })
}

async function nextAnimationFrame(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve())
    })
  })
}

it('keeps each caption in its own accessibility entry and leaves the table blocks unchanged', async () => {
  const view = await mountTableSurface()
  const [first, second] = captionWidgets(view.container)
  const originalBlocks = structuredClone(view.initial.document.blocks)
  const firstCaption = '第一张表：季度收入'
  const secondCaption = '第二张表：成本比较'
  expect(one(first, 'button').getAttribute('aria-label')).toBe('Add caption')
  expect(one(second, 'button').getAttribute('aria-label')).toBe('Add caption')

  const firstBefore = revisionCount(view.api)
  userClick(one(first, 'button'))
  const firstInput = field(first, 'Table caption')
  expect(document.activeElement).toBe(firstInput)
  typeText(firstInput, firstCaption)
  press(firstInput, 'Enter')
  await nextAnimationFrame()
  const firstButton = one<HTMLButtonElement>(first, 'button')
  expect(document.activeElement).toBe(firstButton)
  expect(firstButton.getAttribute('aria-label')).toBe(`Edit table caption: ${firstCaption}`)

  const afterFirst = await saveTableDraft(view, firstBefore)
  expect(afterFirst.blocks).toEqual(originalBlocks)
  expect(afterFirst.tableAccessibility).toEqual({
    [firstTableId]: { caption: firstCaption },
  })

  const secondBefore = revisionCount(view.api)
  userClick(one(second, 'button'))
  const secondInput = field(second, 'Table caption')
  typeText(secondInput, secondCaption)
  press(secondInput, 'Enter')
  await nextAnimationFrame()
  expect(one(second, 'button').getAttribute('aria-label'))
    .toBe(`Edit table caption: ${secondCaption}`)

  const afterBoth = await saveTableDraft(view, secondBefore)
  expect(afterBoth.blocks).toEqual(originalBlocks)
  expect(afterBoth.tableAccessibility).toEqual({
    [firstTableId]: { caption: firstCaption },
    [secondTableId]: { caption: secondCaption },
  })

  const clearBefore = revisionCount(view.api)
  userClick(one(first, 'button'))
  const clearInput = field(first, 'Table caption')
  typeText(clearInput, '')
  press(clearInput, 'Enter')
  await nextAnimationFrame()

  const cleared = await saveTableDraft(view, clearBefore)
  expect(one(first, 'button').getAttribute('aria-label')).toBe('Add caption')
  expect(cleared.blocks).toEqual(originalBlocks)
  expect(cleared.tableAccessibility).toEqual({
    [firstTableId]: { caption: '' },
    [secondTableId]: { caption: secondCaption },
  })

  const tabs = all(view.container, '[role="tab"]')
  expect(tabs.map(tab => tab.textContent.trim())).toEqual(['Content', 'Publication'])
  const content = all(view.container, '[role="tabpanel"]')
    .find(panel => panel.getAttribute('data-state') === 'active')
  if (content === undefined) {
    throw new Error('The Content settings panel never rendered')
  }
  expect(all(content, '[aria-label="Table caption"]')).toHaveLength(0)
})
