import type { MountedPublication } from './publication-support'
import { act } from 'react'
import { afterEach, expect, it } from 'vitest'
import { publishSchema, unpublishSchema } from '@/contracts/publication'
import {
  publicationDocument,
  publicationServer,
  savedAhead,
} from './publication-stub'
import {
  button,
  click,
  drainHostTask,
  mountPublication,
  resetDomPilot,
  texts,
  until,
} from './publication-support'

/*
 * A publish or unpublish the server refuses because another tab saved first.
 * The real coordinator, client, conflict notice and comparison render here;
 * only the editor's document data is supplied. The retained component case
 * still proves the header control, the recovery-copy reload and focus.
 */

afterEach(resetDomPilot)

type Action = 'publish' | 'unpublish'

function writeCalls(view: MountedPublication, route: string) {
  return view.stub.calls.filter(call => `${call.method} ${call.path}` === route)
}

/** The loaded document; unpublish cases start with a live revision. */
function loadedFor(action: Action) {
  const loaded = publicationDocument('Publication conflict')
  if (action === 'unpublish') {
    loaded.liveRevisionId = loaded.headRevisionId
    loaded.liveGeneration = 1
    loaded.livePath = `/posts/${loaded.document.meta.slug}`
  }
  return loaded
}

async function runPublication(view: MountedPublication, action: Action): Promise<void> {
  await act(async () => {
    const state = view.state()
    state.workspace.run(state.actions.publish(action === 'unpublish'))
    await state.settle()
  })
}

/** The one publish/unpublish body, parsed by the schema the client sends. */
function attemptBody(view: MountedPublication, route: string, action: Action) {
  const attempts = writeCalls(view, route)
  expect(attempts).toHaveLength(1)
  return action === 'publish'
    ? publishSchema.parse(attempts[0]?.body)
    : unpublishSchema.parse(attempts[0]?.body)
}

for (const action of ['publish', 'unpublish'] as const) {
  it(`a stale ${action} is refused with the loaded version and shows the conflict`, async () => {
    const loaded = loadedFor(action)
    const external = savedAhead(loaded, 'Latest saved title')
    const route = `POST /api/admin/documents/${loaded.documentId}/${action}`
    const server = publicationServer(loaded)
    const view = mountPublication({ server })
    await view.load()
    // The other tab saved after this editor loaded.
    server.open = external
    await runPublication(view, action)
    expect(view.state().workspace.draft.status).toBe('conflict')
    expect(view.state().workspace.draft.ack.version).toBe(loaded.version)
    expect(view.state().workspace.draft.ack.headRevisionId).toBe(loaded.headRevisionId)
    expect(view.state().workspace.model.envelope.meta.title).toBe('Publication conflict')
    expect(view.container.querySelector('.save-status')?.getAttribute('data-status'))
      .toBe('conflict')
    // The server draft loads, then the conflict is visible and replaces the
    // generic error notice.
    await act(async () => {
      await until(() =>
        view.container.querySelector('.editor-notice[data-tone="conflict"]') !== null)
    })
    expect(view.container.querySelector('.editor-notice[data-tone="error"]')).toBeNull()
    expect(texts(view.container, '.editor-notice[data-tone="conflict"] .editor-notice-description'))
      .toEqual(['This draft was updated elsewhere. Your local edits are preserved.'])
    // The comparison is mounted: Compare renders the server baseline and diff.
    // Use server version cannot reopen without a successful recovery-copy write;
    // the real IndexedDB boundary stays in its own browser adapter. The header
    // needs `next/link`, which this Vitest config cannot resolve, so its
    // disabled publish control stays a precise PW assertion.
    act(() => {
      click(button(view.container, 'Compare changes'))
    })
    await drainHostTask()
    const baseline = 'The baseline is server version '
      + `${external.version}; the selected content is your local draft snapshot.`
    expect(texts(view.container, '.conflict-comparison-summary')).toEqual([baseline])
    expect(view.container.querySelector('[aria-label="Revision differences"]')).not.toBeNull()
    const useServer = view.container.querySelector('button[aria-label="Use server version"]')
    if (useServer === null) {
      throw new Error('The conflict notice has no Use server version control')
    }
    await act(async () => {
      click(useServer)
      await view.state().settle()
    })
    expect(view.state().workspace.draft.localNotice)
      .toBe('Local recovery unavailable. Keep this tab open until a server save succeeds.')
    expect(view.reopenCount()).toBe(0)
    expect(view.state().workspace.draft.status).toBe('conflict')
    const body = attemptBody(view, route, action)
    expect(body.expectedVersion).toBe(loaded.version)
    expect(body.expectedLiveGeneration).toBe(loaded.liveGeneration)
    if (action === 'publish') {
      expect(publishSchema.parse(body).revisionId).toBe(loaded.headRevisionId)
    }
  })
}
