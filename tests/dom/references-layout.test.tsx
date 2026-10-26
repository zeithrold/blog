import { act } from 'react'
import { afterEach, expect, it } from 'vitest'
import { button } from './dom'
import { setMediaState } from './environment'
import { referenceDocument } from './references-stub'
import { clickText, mountReferences, resetReferences } from './references-support'

afterEach(async () => {
  await resetReferences()
})

it('closes the compact settings drawer on resize and keeps it closed on return', async () => {
  const view = mountReferences({
    initial: referenceDocument('Settings drawer layout'),
    width: 390,
    handlers: {},
    settingsLayout: true,
  })
  clickText(view.container, 'Document settings')
  expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()
  await act(async () => {
    await view.api.expectServed()
  })

  setMediaState({ width: 1440 })
  expect(view.container.querySelector('.document-settings')).not.toBeNull()
  expect(document.body.querySelector('[role="dialog"]')).toBeNull()

  setMediaState({ width: 390 })
  expect(button(view.container, 'Document settings')).toBeDefined()
  expect(document.body.querySelector('[role="dialog"]')).toBeNull()
  expect(view.api.calls.filter(call => call.method !== 'GET')).toEqual([])
})
