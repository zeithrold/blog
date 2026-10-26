import { act } from 'react'
import { afterEach, expect, it } from 'vitest'
import { mountAdmin, resetAdmin } from './admin-support'
import {
  all,
  button,
  click,
  combobox,
  field,
  one,
  openCombobox,
  option,
  press,
  text,
  typeText,
} from './dom'
import { mountEditorChrome, resetEditorChrome } from './editor-chrome-support'
import { until } from './environment'

afterEach(async () => {
  await resetAdmin()
  await resetEditorChrome()
})

async function chooseTimezone(root: ParentNode, timezone: string): Promise<void> {
  const control = combobox(root, 'Publication timezone')
  await act(async () => {
    openCombobox(control)
    await until(() => document.body.querySelector('[role="option"]') !== null)
  })
  typeText(field(document.body, 'Search cities or timezones'), timezone)
  await act(async () => {
    await until(() => all(document.body, '[role="option"]').some(item =>
      item.textContent.includes(timezone)))
  })
  act(() => click(option(document.body, timezone)))
}

async function chooseLanguage(root: ParentNode, locale: 'English' | '简体中文'): Promise<void> {
  const language = combobox(root, 'Language')
  await act(async () => {
    openCombobox(language)
    await until(() => document.body.querySelector('[role="option"]') !== null)
  })
  act(() => click(option(document.body, locale)))
}

it('publication settings retain local timezone state across tabs and interface language changes', async () => {
  const view = await mountEditorChrome({ width: 1440 })
  act(() => click(button(view.container, 'Publication')))
  act(() => click(button(view.container, 'Scheduled publication')))
  await chooseTimezone(view.container, 'Asia/Tokyo')
  expect(combobox(view.container, 'Publication timezone').textContent).toContain('Asia/Tokyo')

  act(() => click(button(view.container, 'Content')))
  act(() => click(button(view.container, 'Publication')))
  expect(combobox(view.container, 'Publication timezone').textContent).toContain('Asia/Tokyo')

  await chooseLanguage(view.container, '简体中文')
  await until(() => all(view.container, '[role="tab"]').some(tab => tab.textContent.trim() === '发布'))
  expect(combobox(view.container, '发布时区').textContent).toContain('Asia/Tokyo')
  expect(view.api.calls.every(call => call.method === 'GET')).toBe(true)
})

it('save and publication badges expose the same state after an English-to-Chinese change', async () => {
  const view = await mountEditorChrome({ width: 1440 })
  typeText(field(view.container, 'Slug'), 'narrow-status-state')

  const save = one(view.container, '.workspace-status .save-status')
  const publication = one(view.container, '.workspace-status [data-state="draft"]')
  expect(save.getAttribute('data-status')).toBe('dirty')
  expect(save.getAttribute('data-tone')).toBe('warning')
  expect(text(view.container, '.workspace-status .save-status')).toBe('Unsaved changes')
  expect(text(view.container, '.workspace-status [data-state="draft"]')).toBe('Draft')
  expect(publication.getAttribute('data-state')).toBe('draft')

  await chooseLanguage(view.container, '简体中文')
  await until(() => view.container.querySelector('.workspace-status .save-status')?.textContent.trim() === '未保存修改')
  expect(view.container.querySelector('.workspace-status [data-state="draft"]')?.textContent.trim())
    .toBe('草稿')
  expect(save.getAttribute('data-status')).toBe('dirty')
})

it('the catalog page and editor publish the same dirty SaveStatus contract', async () => {
  const editor = await mountEditorChrome({ width: 1440 })
  typeText(field(editor.container, 'Slug'), 'editor-status-parity')
  const editorStatus = one(editor.container, '.workspace-header .save-status')
  const catalog = await mountAdmin({ kind: 'catalog', width: 1440 })
  act(() => click(button(catalog.container, 'New tag')))
  typeText(field(catalog.container, 'Name'), 'Unsaved catalog entry')
  const catalogStatus = one(catalog.container, '.catalog-dirty')

  expect(editorStatus.getAttribute('data-status')).toBe('dirty')
  expect(catalogStatus.getAttribute('data-status')).toBe('dirty')
  expect(editorStatus.getAttribute('data-tone')).toBe(catalogStatus.getAttribute('data-tone'))
  expect(editorStatus.textContent.trim()).toBe('Unsaved changes')
  expect(catalogStatus.textContent.trim()).toBe('Unsaved changes')
})

const appearanceStates = [
  {
    mode: 'Light',
    palettes: [
      'Neutral',
      'Terracotta',
      'Moss',
      'Ocean',
      'Plum',
      'Graphite',
    ],
  },
  {
    mode: 'Dark',
    palettes: [
      'Neutral',
      'Terracotta',
      'Moss',
      'Ocean',
      'Plum',
      'Graphite',
    ],
  },
  {
    mode: 'System',
    palettes: [
      'Neutral',
      'Terracotta',
      'Moss',
      'Ocean',
      'Plum',
      'Graphite',
    ],
  },
] as const
const chineseAppearanceStates = [
  {
    mode: '浅色',
    palettes: [
      '中性',
      '暖陶',
      '苔绿',
      '海蓝',
      '莓紫',
      '石墨',
    ],
  },
  {
    mode: '深色',
    palettes: [
      '中性',
      '暖陶',
      '苔绿',
      '海蓝',
      '莓紫',
      '石墨',
    ],
  },
  {
    mode: '跟随系统',
    palettes: [
      '中性',
      '暖陶',
      '苔绿',
      '海蓝',
      '莓紫',
      '石墨',
    ],
  },
] as const

async function chooseAppearance(root: ParentNode, locale: 'en' | 'zh-CN', label: string): Promise<void> {
  const appearance = root.querySelector<HTMLButtonElement>(
    `button[aria-label="${locale === 'en' ? 'Appearance' : '外观'}"]`,
  )
  expect(appearance).not.toBeNull()
  if (appearance === null) {
    throw new Error('The appearance trigger is missing')
  }
  await act(async () => {
    press(appearance, 'Enter')
    await until(() => document.body.querySelector('[role="menuitemradio"]') !== null)
  })
  const choice = all(document.body, '[role="menuitemradio"]')
    .find(item => item.textContent.replace(/\s+/g, ' ').trim() === label)
  expect(choice).toBeDefined()
  if (choice === undefined) {
    throw new Error(`The appearance choice "${label}" is missing`)
  }
  await act(async () => {
    press(choice, 'Enter')
    await until(() => document.body.querySelector('[role="menu"]') === null)
  })
}

async function expectSelectedAppearance(
  root: ParentNode,
  locale: 'en' | 'zh-CN',
  mode: string,
  palette: string,
): Promise<void> {
  const appearance = root.querySelector<HTMLButtonElement>(
    `button[aria-label="${locale === 'en' ? 'Appearance' : '外观'}"]`,
  )
  if (appearance === null) {
    throw new Error('The appearance trigger is missing')
  }
  await act(async () => {
    press(appearance, 'Enter')
    await until(() => document.body.querySelector('[role="menuitemradio"]') !== null)
  })
  const selected = all(document.body, '[role="menuitemradio"][aria-checked="true"]')
    .map(item => item.textContent.replace(/\s+/g, ' ').trim())
  expect(selected).toEqual([mode, palette])
  await act(async () => {
    press(one(document.body, '[role="menu"]'), 'Escape')
    await until(() => document.body.querySelector('[role="menu"]') === null)
  })
}

it('36 bilingual appearance choices change real preference state without writing a draft', async () => {
  const view = await mountEditorChrome({ width: 1440 })
  let states = 0
  for (const scenario of appearanceStates) {
    await chooseAppearance(view.container, 'en', scenario.mode)
    for (const palette of scenario.palettes) {
      await chooseAppearance(view.container, 'en', palette)
      await expectSelectedAppearance(view.container, 'en', scenario.mode, palette)
      states++
    }
  }

  await chooseLanguage(view.container, '简体中文')
  await until(() => view.container.querySelector('[aria-label="外观"]') !== null)
  for (const scenario of chineseAppearanceStates) {
    await chooseAppearance(view.container, 'zh-CN', scenario.mode)
    for (const palette of scenario.palettes) {
      await chooseAppearance(view.container, 'zh-CN', palette)
      await expectSelectedAppearance(view.container, 'zh-CN', scenario.mode, palette)
      states++
    }
  }
  expect(states).toBe(36)
  expect(view.api.calls.every(call => call.method === 'GET')).toBe(true)
})

it('the compact inspector exposes its reference dialog and close state', async () => {
  const view = await mountEditorChrome({ width: 1440 })
  const settings = one(view.container, 'aside[aria-label="Document settings"]')

  act(() => click(button(settings, 'References (0)')))
  act(() => click(button(settings, 'Add reference')))
  await until(() => all(document.body, '[role="dialog"]').length === 1)
  expect(all(document.body, '[role="dialog"]').map(dialog => dialog.textContent).join(' '))
    .toContain('Add reference')
  act(() => click(button(document.body, 'Cancel')))
  await until(() => all(document.body, '[role="dialog"]').length === 0)
  expect(text(settings, '[role="tablist"]')).toContain('Content')
  expect(view.api.unhandled).toEqual([])
})
