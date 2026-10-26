import { act } from 'react'
import { afterEach, expect, it } from 'vitest'
import { mountAdmin, resetAdmin } from './admin-support'
import {
  all,
  click,
  combobox,
  openCombobox,
  option,
  texts,
} from './dom'
import { until } from './environment'

afterEach(resetAdmin)

it('the document type filter opens its real choices and sends the chosen type', async () => {
  const view = await mountAdmin({ kind: 'controls' })
  await until(() => view.container.querySelector('[role="combobox"]') !== null)

  const type = combobox(view.container, 'Document type')
  await act(async () => {
    openCombobox(type)
    await until(() => all(document.body, '[role="option"]').length > 0)
  })
  expect(texts(document.body, '[role="option"]')).toEqual([
    'All types',
    'Post',
    'Page',
  ])

  await act(async () => {
    click(option(document.body, 'Post'))
    await view.api.expectServed()
  })
  expect(view.api.calls.map(call => call.query.get('kind'))).toContain('article')
  expect(view.api.unhandled).toEqual([])
})

it('the compact admin controls use Chinese choices and respect the declared mobile host', async () => {
  const view = await mountAdmin({
    kind: 'controls',
    width: 320,
    reducedMotion: true,
  })
  const language = combobox(view.container, 'Language')
  await act(async () => {
    openCombobox(language)
    await until(() => all(document.body, '[role="option"]').length > 0)
  })
  act(() => click(option(document.body, '简体中文')))
  await until(() => view.container.querySelector('[role="combobox"][aria-label="文档类型"]') !== null)

  const type = combobox(view.container, '文档类型')
  await act(async () => {
    openCombobox(type)
    await until(() => texts(document.body, '[role="option"]').length === 3)
  })
  expect(texts(document.body, '[role="option"]')).toEqual([
    '所有类型',
    '文章',
    '页面',
  ])
  expect(type.getAttribute('aria-expanded')).toBe('true')
})
