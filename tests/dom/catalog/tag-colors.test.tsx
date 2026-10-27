import { act } from 'react'
import { afterEach, expect, it } from 'vitest'
import { catalogEntry, catalogPage } from '~/tests/dom/shared/fixtures'
import { failure } from '~/tests/dom/shared/http'
import {
  button,
  click,
  editButton,
  mountCatalog,
  one,
  resetCatalogDom,
  settleCatalog,
} from './catalog-support'

afterEach(resetCatalogDom)

it('a color-only edit is dirty, survives failure, saves and resets to the default', async () => {
  const tag = { ...catalogEntry({ kind: 'tag', name: '彩色', slug: 'color' }), color: 'blue' as const }
  const saved = { ...tag, color: 'pink', version: 1 }
  let writes = 0
  const view = mountCatalog({
    kind: 'tag',
    locale: 'zh',
    mode: 'dark',
    handlers: {
      'GET /api/admin/catalog/tag': () => ({ body: catalogPage([tag]) }),
      'PUT /api/admin/catalog/tag/:id': () => ++writes === 1 ? failure(503, 'UNAVAILABLE') : { body: saved },
    },
  })
  await settleCatalog(view)
  act(() => click(editButton(view.container, '编辑 彩色')))
  expect(one(view.container, 'button[aria-label="蓝色"]').getAttribute('aria-pressed')).toBe('true')
  expect(button(view.container, '保存').disabled).toBe(true)
  act(() => click(one(view.container, 'button[aria-label="粉色"]')))
  expect(button(view.container, '保存').disabled).toBe(false)
  expect(view.container.querySelector('legend')?.textContent).toBe('标签颜色')
  expect(view.container.querySelectorAll('[data-slot="color-grid"] button')).toHaveLength(8)
  act(() => click(button(view.container, '保存')))
  await settleCatalog(view)
  expect(one(view.container, 'button[aria-label="粉色"]').getAttribute('aria-pressed')).toBe('true')
  expect(view.container.querySelector('[role="alert"]')).not.toBeNull()
  act(() => click(button(view.container, '保存')))
  await settleCatalog(view)
  expect(view.api.calls.filter(call => call.method === 'PUT').map(call => call.json)).toEqual([
    { name: '彩色', slug: 'color', color: 'pink', retired: false, expectedVersion: 0 },
    { name: '彩色', slug: 'color', color: 'pink', retired: false, expectedVersion: 0 },
  ])
  expect(one(view.container, 'button[aria-label="默认"]').getAttribute('aria-pressed')).toBe('true')
})

it('series keep the existing form without a color picker', async () => {
  const view = mountCatalog({
    kind: 'series',
    handlers: { 'GET /api/admin/catalog/series': () => ({ body: catalogPage([]) }) },
  })
  await settleCatalog(view)
  expect(view.container.querySelector('[data-slot="color-grid"]')).toBeNull()
})
