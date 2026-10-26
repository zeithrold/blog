import type { ConflictCopy } from './history-conflict-remaining-fixtures'
import type { MountedConflict } from './history-conflict-remaining-support'
import { act } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import {
  conflictCopy,
  conflictTexts,
  heldReply,
} from './history-conflict-remaining-fixtures'
import {
  actionButton,
  differences,
  mountConflict,
  noticeByTitle,
  notices,
  paragraphOf,
  publicationWrites,
  requiredNotice,
  resetConflictDom,
  writeRoutes,
} from './history-conflict-remaining-support'
import { advance, button, click, drainHostTask, text } from './publication-dom'

/*
 * The draft conflict the editor shows after a save another window already won:
 * the real draft coordinator, client, conflict notice, comparison and diff render
 * here, with only `fetch` replaced by the case's table and the BlockNote editor
 * reduced to the document data and change hook its controllers read.
 *
 * These cases prove what the notice says, the choice variants and descriptions,
 * the comparison's disclosure and before/after text, the stale recompute and the
 * request log. Painted icons, 44px targets, viewport bounds, native focus return
 * and the live editor element stay in the component case.
 */

afterEach(() => {
  vi.useRealTimers()
  resetConflictDom()
})

/**
 * The author's paragraph becomes one content transaction, then the production
 * autosave interval sends it and the server refuses the version this window held.
 *
 * Timers are faked only for that interval; the reads and renders that follow use
 * real ones, so a held reply and a re-render are awaited rather than advanced.
 */
async function refuseTheStaleSave(view: MountedConflict): Promise<void> {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  view.writeParagraph(conflictTexts.local)
  await advance(2000)
  vi.useRealTimers()
  await drainHostTask()
}

/** Opens the one changed paragraph and checks the drafts it puts side by side. */
async function expandChanged(
  view: MountedConflict,
  copy: ConflictCopy,
  after: string,
): Promise<void> {
  const region = differences(view.container, copy)
  if (region === null) {
    throw new Error(`No differences region labelled ${JSON.stringify(copy.differences)}`)
  }
  const rows = Array.from(region.querySelectorAll<HTMLElement>('.diff-row[data-change="changed"]'))
  expect(rows).toHaveLength(1)
  const row = rows[0]
  if (row === undefined) {
    throw new Error('The comparison shows no changed paragraph')
  }
  const trigger = row.querySelector('.diff-block-trigger')
  if (!(trigger instanceof HTMLElement)) {
    throw new TypeError('The changed paragraph has no disclosure')
  }
  act(() => {
    click(trigger)
  })
  await drainHostTask()
  expect(text(row, '[data-side="before"] h4')).toBe(copy.before)
  expect(text(row, '[data-side="after"] h4')).toBe(copy.after)
  expect(text(row, '[data-side="before"] pre')).toBe(conflictTexts.server)
  expect(text(row, '[data-side="after"] pre')).toBe(after)
}

it('a pending conflict refresh explains preserved document edits and merges into one actionable notice', async () => {
  const copy = conflictCopy('zh-CN')
  const refresh = heldReply()
  const view = mountConflict({ locale: 'zh-CN', refresh })
  try {
    await refuseTheStaleSave(view)
    const pending = requiredNotice(view.container, copy.pending)
    expect(notices(view.container, 'conflict')).toHaveLength(1)
    expect(text(pending, '[role="alert"]')).toBe(copy.pendingHelp)
    expect(pending.textContent).not.toMatch(/catalog|分类项/i)
    // The draft the editor holds is still the paragraph this window wrote.
    expect(paragraphOf(await view.state().workspace.model.snapshot()))
      .toEqual([
        { type: 'text', text: conflictTexts.local, styles: {} },
      ])
    refresh.release()
    await drainHostTask()
    const merged = requiredNotice(view.container, copy.title)
    // The merged notice replaces the pending one: one conflict notice, no alert.
    expect(notices(view.container, 'conflict')).toHaveLength(1)
    expect(noticeByTitle(view.container, copy.pending)).toBeNull()
    expect(view.container.querySelector('[role="alert"]')).toBeNull()
    expect(text(merged, '.editor-notice-description')).toBe(copy.description)
    expect(writeRoutes(view)).toEqual(['PUT /api/admin/documents/:id/revisions'])
    expect(publicationWrites(view)).toEqual([])
  }
  finally {
    refresh.release()
    view.unmount()
  }
})

/** The one button of the open confirmation dialog with this label. */
function dialogButton(name: string): HTMLButtonElement {
  const dialog = document.querySelector('[role="dialog"]')
  if (dialog === null) {
    throw new Error('No confirmation dialog is open')
  }
  const found = Array.from(dialog.querySelectorAll('button'))
    .find(element => element.textContent.trim() === name)
  if (found === undefined) {
    throw new Error(`No dialog button named ${JSON.stringify(name)}`)
  }
  return found
}

/*
 * The action path: keeping local edits, cancelling, and asking for the server
 * version without a recovery copy. The product decides what to write; the
 * component case keeps the successful reopen, which needs a real editor body.
 */
it('the conflict actions write only the refused save and an unavailable recovery copy never reopens', async () => {
  const copy = conflictCopy('en')
  const view = mountConflict({ locale: 'en' })
  try {
    await refuseTheStaleSave(view)
    const notice = requiredNotice(view.container, copy.title)
    // Keeping local edits asks first, and cancelling leaves the draft untouched.
    act(() => {
      click(actionButton(view.container, copy.keep))
    })
    await drainHostTask()
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
    act(() => {
      click(dialogButton(copy.cancel))
    })
    await drainHostTask()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    // Asking for the server version persists a recovery copy first. jsdom has no
    // IndexedDB, so the product keeps the draft, says so, and does not reopen.
    act(() => {
      click(actionButton(view.container, copy.open))
    })
    await drainHostTask()
    expect(view.state().workspace.draft.localNotice)
      .toBe('Local recovery unavailable. Keep this tab open until a server save succeeds.')
    expect(view.state().reopenCount()).toBe(0)
    expect(view.state().workspace.draft.status).toBe('conflict')
    expect(notice.isConnected).toBe(true)
    // The actions wrote nothing the refusal had not already written.
    expect(writeRoutes(view)).toEqual(['PUT /api/admin/documents/:id/revisions'])
    expect(publicationWrites(view)).toEqual([])
  }
  finally {
    view.unmount()
  }
})

/** The merged notice: one conflict tone, no alert, and its own description. */
function expectMergedNotice(view: MountedConflict, copy: ConflictCopy): HTMLElement {
  const notice = requiredNotice(view.container, copy.title)
  expect(notices(view.container, 'conflict')).toHaveLength(1)
  expect(notices(view.container, 'error')).toHaveLength(0)
  expect(view.container.querySelector('[role="alert"]')).toBeNull()
  expect(text(notice, '.editor-notice-description')).toBe(copy.description)
  expect(notice.textContent).not.toMatch(/catalog|分类项/i)
  // The icon element belongs to the notice; the painted SVG stays a browser check.
  expect(notice.querySelector('.editor-notice-icon[aria-hidden="true"] svg')).not.toBeNull()
  return notice
}

/** One ghost disclosure and two outlined choices, each described by its own copy. */
function expectChoices(view: MountedConflict, copy: ConflictCopy): HTMLButtonElement {
  const compare = button(view.container, copy.compare)
  expect(compare.getAttribute('data-variant')).toBe('ghost')
  expect(compare.getAttribute('aria-expanded')).toBe('false')
  expect(compare.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
  for (const [name, help] of [
    [copy.keep, copy.keepHelp],
    [copy.open, copy.openHelp],
  ] as const) {
    const action = actionButton(view.container, name)
    expect(action.getAttribute('data-variant')).toBe('outline')
    const describedBy = action.getAttribute('aria-describedby')
    expect(describedBy).not.toBeNull()
    expect(document.getElementById(describedBy ?? '')?.textContent).toBe(help)
  }
  return compare
}

/** Comparing opens the difference, and the disclosure collapses and reopens it. */
async function toggleComparison(
  view: MountedConflict,
  copy: ConflictCopy,
  compare: HTMLButtonElement,
): Promise<void> {
  act(() => {
    click(compare)
  })
  await drainHostTask()
  expect(compare.getAttribute('aria-expanded')).toBe('true')
  await expandChanged(view, copy, conflictTexts.local)
  act(() => {
    click(compare)
  })
  await drainHostTask()
  expect(compare.getAttribute('aria-expanded')).toBe('false')
  expect(differences(view.container, copy)).toBeNull()
  act(() => {
    click(compare)
  })
  await drainHostTask()
  expect(compare.getAttribute('aria-expanded')).toBe('true')
  expect(differences(view.container, copy)).not.toBeNull()
}

/** A later edit marks the comparison stale; comparing again replaces it. */
async function recomputeStale(
  view: MountedConflict,
  copy: ConflictCopy,
  compare: HTMLButtonElement,
): Promise<void> {
  view.writeParagraph(conflictTexts.updated)
  const stale = view.container.querySelector('.conflict-comparison-stale')
  expect(stale?.getAttribute('role')).toBe('status')
  expect(stale?.textContent.trim()).toBe(copy.stale)
  act(() => {
    click(compare)
  })
  await drainHostTask()
  expect(compare.getAttribute('aria-expanded')).toBe('true')
  expect(view.container.querySelector('.conflict-comparison-stale')).toBeNull()
  await expandChanged(view, copy, conflictTexts.updated)
}

for (const scenario of [
  { locale: 'en', rendered: 'en' },
  { locale: 'zh-CN', rendered: 'zh-CN' },
] as const) {
  it(`conflict choices describe both drafts and the refreshed comparison in ${scenario.rendered}`, async () => {
    const copy = conflictCopy(scenario.locale)
    const view = mountConflict({ locale: scenario.locale })
    try {
      await refuseTheStaleSave(view)
      expectMergedNotice(view, copy)
      const compare = expectChoices(view, copy)
      await toggleComparison(view, copy, compare)
      await recomputeStale(view, copy, compare)
      // Only the refused save was attempted, and nothing was published.
      expect(writeRoutes(view)).toEqual(['PUT /api/admin/documents/:id/revisions'])
      expect(publicationWrites(view)).toEqual([])
    }
    finally {
      view.unmount()
    }
  })
}
