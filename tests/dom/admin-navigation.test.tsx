import { act } from 'react'
import { afterEach, expect, it } from 'vitest'
import { mountAdmin, resetAdmin } from './admin-support'
import {
  all,
  button,
  one,
  press,
  text,
} from './dom'
import { until } from './environment'

afterEach(resetAdmin)

for (const width of [390, 800]) {
  it(`the compact admin menu lists the current section and every destination at ${width}px`, async () => {
    const view = await mountAdmin({ kind: 'navigation', width })
    const trigger = button(view.container, 'Operations')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')

    await act(async () => {
      press(trigger, 'Enter')
      await until(() => document.body.querySelector('[role="menu"]') !== null)
    })
    const links = all<HTMLAnchorElement>(document.body, '[role="menu"] a')
    expect(links.map(link => link.textContent.replace(/\s+/g, ' ').trim())).toEqual([
      'Documents',
      'Media library',
      'Tags',
      'Series',
      'Operations',
      'View site',
    ])
    expect(links.map(link => link.getAttribute('href'))).toEqual([
      '/admin/documents',
      '/admin/media',
      '/admin/tags',
      '/admin/series',
      '/admin/operations',
      '/',
    ])
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
  })
}

it('the reduced-motion admin menu remains operable from its keyboard trigger', async () => {
  const view = await mountAdmin({ kind: 'navigation', width: 390, reducedMotion: true })
  const trigger = button(view.container, 'Operations')
  await act(async () => {
    trigger.focus()
    press(trigger, 'Enter')
    await until(() => document.body.querySelector('[role="menu"]') !== null)
  })
  expect(text(document.body, '[role="menu"]')).toContain('Documents')
  expect(trigger.getAttribute('aria-expanded')).toBe('true')
  await act(async () => {
    press(one(document.body, '[role="menu"]'), 'Escape')
    await until(() => document.body.querySelector('[role="menu"]') === null)
  })
  expect(trigger.getAttribute('aria-expanded')).toBe('false')
})

it('the compact navigation declares its named region and the active operation link', async () => {
  const view = await mountAdmin({ kind: 'navigation', width: 768 })
  const navigation = all(view.container, 'nav[aria-label="Admin navigation"]')
    .find(nav => nav.querySelector('.workspace-navigation-mobile') !== null)
  expect(navigation).toBeDefined()
  if (navigation === undefined) {
    throw new Error('The compact admin navigation is missing')
  }
  const trigger = button(navigation, 'Operations')
  expect(trigger.className).toContain('workspace-navigation-mobile')
  await act(async () => {
    press(trigger, 'Enter')
    await until(() => document.body.querySelector('[role="menu"]') !== null)
  })
  const operation = all<HTMLAnchorElement>(document.body, '[role="menu"] a')
    .find(link => link.getAttribute('href') === '/admin/operations')
  expect(operation).toBeDefined()
  if (operation === undefined) {
    throw new Error('The active operation link is missing')
  }
  expect(operation.textContent).toContain('Operations')
})
