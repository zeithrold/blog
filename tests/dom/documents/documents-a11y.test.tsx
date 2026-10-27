import { act } from 'react'
import { afterEach, expect, it } from 'vitest'
import { documentsCopy } from '~/tests/dom/shared/copy'
import {
  acknowledgementFor,
  documentEntry,
  selectDocuments,
} from '~/tests/dom/shared/fixtures'
import { defer, failure } from '~/tests/dom/shared/http'
import {
  button,
  click,
  combobox,
  drainHostTask,
  mountDocuments,
  openCombobox,
  option,
  press,
  resetDocumentsDom,
  settleDocuments,
} from './documents-support'

afterEach(resetDocumentsDom)

async function restoredNotices(locale: 'en' | 'zh', width: number, mode: 'light' | 'dark'): Promise<void> {
  const target = documentEntry({ title: `Notice target ${locale}` })
  const other = documentEntry({ title: `Notice other ${locale}` })
  const held = defer()
  const captured = defer()
  let calls = 0
  const view = mountDocuments({
    handlers: {
      'GET /api/admin/documents': async (call) => {
        calls += 1
        if (calls <= 2) {
          return selectDocuments([target, other], call)
        }
        captured.open()
        await held.promise
        return failure(503, 'UNAVAILABLE')
      },
      'POST /api/admin/documents/:id/restore-deleted': () => ({
        body: acknowledgementFor(target, { version: target.version + 1 }),
      }),
    },
    locale,
    mode,
    width,
  })
  try {
    await settleDocuments(view)
    const copy = documentsCopy[locale]
    openCombobox(combobox(view.container, copy.state))
    press(option(document, copy.trash), 'Enter')
    await settleDocuments(view)
    const row = Array.from(view.container.querySelectorAll(`[aria-label="${copy.title}"] li`))
      .find(item => item.textContent.includes(target.title))
    if (row === undefined) {
      throw new Error(`No trash row rendered for ${target.title}`)
    }
    act(() => {
      click(button(row, copy.restore))
    })
    await act(async () => {
      await captured.promise
    })
    await drainHostTask()
    held.open()
    await settleDocuments(view)
    expect(view.container.querySelector('[role="alert"]')?.getAttribute('tabindex')).toBe('-1')
    expect(view.container.querySelector('[role="alert"]')?.textContent).toContain(copy.loadError)
    expect(view.container.querySelector('[role="status"]')?.textContent).toContain(copy.restored)
  }
  finally {
    held.open()
  }
}

it('English restoration and refresh notices render as an alert and status', async () => {
  await restoredNotices('en', 1440, 'light')
})

it('Chinese restoration and refresh notices render as an alert and status', async () => {
  await restoredNotices('zh', 320, 'dark')
})
