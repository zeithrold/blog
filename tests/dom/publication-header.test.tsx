import type { MountedPublication } from './publication-types'
import { act } from 'react'
import { afterEach, expect, it } from 'vitest'
import {
  publicationDocument,
  publicationSchedule,
  publicationServer,
  savedAhead,
} from './publication-stub'
import {
  drainHostTask,
  mountPublication,
  resetDomPilot,
  until,
} from './publication-support'

/*
 * The real EditorHeader against the same workspace and actions. The host link
 * boundary (`tests/components/src/adapters/next-link.tsx` and
 * `next-navigation.ts` in the official config) proves anchor presence and href,
 * not Next routing.
 */

afterEach(resetDomPilot)

function publishControl(view: MountedPublication): HTMLButtonElement {
  const action = view.container.querySelector('.editor-publish-action')
  if (!(action instanceof HTMLButtonElement)) {
    throw new TypeError('The header has no publish control')
  }
  return action
}

async function clickPublish(view: MountedPublication): Promise<void> {
  const action = publishControl(view)
  expect(action.disabled).toBe(false)
  await act(async () => {
    action.click()
    await view.state().settle()
  })
  await drainHostTask()
}

it('the real header disables publish during a conflict and keeps the scheduled badge', async () => {
  const loaded = publicationDocument('Header conflict')
  const pending = publicationSchedule(loaded)
  const server = publicationServer(loaded, [pending])
  const view = mountPublication({
    server,
    header: { livePath: () => server.open.livePath },
  })
  await view.load()
  await act(async () => {
    await until(() => view.container.querySelector('.workspace-status') !== null)
  })
  expect(view.container.querySelector('.workspace-status')?.textContent).toContain('Scheduled')
  expect(publishControl(view).disabled).toBe(false)
  server.open = savedAhead(loaded, 'Latest saved title')
  await clickPublish(view)
  expect(view.state().workspace.draft.status).toBe('conflict')
  expect(publishControl(view).disabled).toBe(true)
})

it('the real header renders the live link href after publishing', async () => {
  const open = publicationDocument('Header live link')
  const server = publicationServer(open)
  const view = mountPublication({
    server,
    header: { livePath: () => server.open.livePath },
  })
  await view.load()
  await drainHostTask()
  await clickPublish(view)
  await act(async () => {
    await until(() => view.container.querySelector('.editor-live-link') !== null)
  })
  const link = view.container.querySelector('.editor-live-link')
  if (!(link instanceof HTMLAnchorElement)) {
    throw new TypeError('The header has no live link')
  }
  expect(link.getAttribute('href')).toBe(`/posts/${open.document.meta.slug}`)
})
