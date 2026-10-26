import type { EditorHistoryWorkspace } from '@/features/editor/workspace/editor-history'
import { afterEach, expect, it } from 'vitest'
import { EditorHistory } from '@/features/editor/workspace/editor-history'
import { historyCopy } from '~/tests/components/support/history-copy'
import { historyCase, serveFetch } from './history-page-support'
import { click, renderElement, resetDomPage, visibleText } from './history-state-support'

/**
 * The editor's own compact history panel, rendered in jsdom.
 *
 * `EditorHistory` reads only the opened document, the acknowledged head/live pair,
 * the busy flag and the workspace runner, so the case passes exactly those; the
 * rows come from the real `useRevisionHistory` and the case's HTTP table. BlockNote
 * is not involved. Geometry, hit targets and native focus stay browser checks.
 */

const pageLocales = ['en', 'zh-CN'] as const

/** The control a row uses to preview its revision. */
function previewControl(row: Element | undefined): Element | null {
  return row?.querySelector('a[target="_blank"]') ?? null
}

/** The control a row uses to restore its revision. */
function restoreControl(row: Element | undefined): HTMLButtonElement | null {
  return row?.querySelector('button') ?? null
}

/**
 * Each control owns its accessible name and carries a decorative icon.
 *
 * jsdom proves that name and the icon's presence; that the icon is painted is a
 * browser fact and stays with the Playwright case.
 */
function expectRowControls(row: Element): void {
  for (const control of [
    previewControl(row),
    restoreControl(row),
  ]) {
    expect(control?.getAttribute('aria-label')).toMatch(/\S/)
    expect(control?.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  }
}

/** Any stored identifier: the panel must render labels, never one of these. */
const uuid = /[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}/i

afterEach(resetDomPage)

for (const locale of pageLocales) {
  const text = historyCopy[locale === 'en' ? 'en' : 'zh']
  it(`lists saved revisions with restore and preview in the editor panel in ${locale}`, async () => {
    const fixture = historyCase()
    serveFetch({
      [`GET ${fixture.path}/revisions`]: () => ({ body: fixture.history }),
    })
    const flights: Promise<unknown>[] = []
    // What the panel reads of the workspace. A whole `Workspace` satisfies this too.
    const workspace: EditorHistoryWorkspace = {
      props: { initial: fixture.initial },
      draft: { ack: fixture.initial },
      busy: false,
      run: (task) => {
        flights.push(task)
      },
    }
    const view = renderElement(
      <EditorHistory workspace={workspace} restore={async () => { /* the case only reads */ }} />,
      locale,
    )
    // The panel lists its revisions when a reader opens it.
    await click(view.button(text.title))
    const region = view.container.querySelector(`[role="region"][aria-label="${text.title}"]`)
    if (region === null) {
      throw new TypeError(`No revision region labelled ${text.title}`)
    }
    const rows = Array.from(region.querySelectorAll('.revision-list li'))
    expect(rows).toHaveLength(3)
    // Opening it asked the workspace to run the real revision read.
    expect(flights).toHaveLength(1)
    const names = Array.from(region.querySelectorAll('strong'), item => visibleText(item))
    expect(names).toEqual([
      `${text.revision} 3`,
      `${text.revision} 2`,
      `${text.revision} 1`,
    ])
    // The head draft cannot be restored; the stored older revision can.
    expect(restoreControl(rows[0])?.disabled).toBe(true)
    expect(restoreControl(rows[1])?.disabled).toBe(false)
    // The preview entry points at that stored revision and opens it in a new tab.
    expect(previewControl(rows[1])?.getAttribute('href'))
      .toBe(`/admin/preview/${fixture.initial.documentId}/${fixture.first.revisionId}`)
    for (const row of rows) {
      expectRowControls(row)
    }
    // Rows read as labels: no raw identifier of any kind, document id included.
    expect(visibleText(region)).not.toMatch(uuid)
  })
}
