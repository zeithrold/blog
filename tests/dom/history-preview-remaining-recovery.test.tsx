import { afterEach, expect, it } from 'vitest'
import { mountRecoveryNotice } from './history-preview-remaining-recovery-support'
import {
  accessibleName,
  controlNamed,
  previewCopy,
  recoverySavedAt,
  required,
} from './history-preview-remaining-support'
import { click, resetDomPage, visibleText } from './history-state-support'

/**
 * The local recovery notice, rendered by the product's own notice component.
 *
 * The notice's copy, its saved time, its icon and its two actions are proved
 * here; the case supplies the `Recovery` value that the workspace normally reads
 * from IndexedDB, and the one state transition the product's notice container
 * owns for Dismiss. Storing the copy, reading it after a reload and applying it
 * to the live editor stay in the browser case.
 */

const pageLocales = ['en', 'zh-CN'] as const

afterEach(resetDomPage)

/** The notice is a labelled `section`, whose implicit role the DOM query cannot select. */
function noticeRegion(name: string): HTMLElement | null {
  return Array.from(document.querySelectorAll('section[aria-labelledby]'))
    .filter((item): item is HTMLElement => item instanceof HTMLElement)
    .find(item => accessibleName(item) === name) ?? null
}

for (const locale of pageLocales) {
  const copy = previewCopy[locale]

  it(`offers the stored local copy with its saved time and both actions in ${locale}`, async () => {
    const surface = mountRecoveryNotice(locale)
    const notice = required(noticeRegion(copy.recovery), 'the local recovery notice')
    expect(notice.getAttribute('data-tone')).toBe('recovery')
    expect(visibleText(notice.querySelector('h2'))).toBe(copy.recovery)
    expect(visibleText(notice.querySelector('.editor-notice-description'))).toBe(copy.recoveryDescription)
    // The saved time is the stored instant, not a time the notice invented.
    const time = required(notice.querySelector('time'), 'the saved time')
    expect(time.getAttribute('datetime')).toBe(new Date(recoverySavedAt).toISOString())
    expect(visibleText(time)).toContain('2026')
    expect(visibleText(notice.querySelector('.editor-notice-meta'))).toContain(copy.saved)
    // The notice's tone icon and both action icons are present; that they are painted is a browser fact.
    expect(notice.querySelector('.editor-notice-icon[aria-hidden="true"] svg')).not.toBeNull()
    for (const name of [copy.recover, copy.dismiss]) {
      const action = required(controlNamed(name), `the ${name} action`)
      expect(action.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
    }
    expect(document.querySelector('[role="alert"]')).toBeNull()
    await click(required(controlNamed(copy.dismiss), 'the dismiss action'))
    // Dismissing hides the notice for this session.
    expect(noticeRegion(copy.recovery)).toBeNull()
    expect(surface.stub.calls).toEqual([])
  })

  it(`reopens the stored local copy from the notice in ${locale}`, async () => {
    const surface = mountRecoveryNotice(locale)
    await click(required(controlNamed(copy.recover), 'the reopen action'))
    expect(surface.reopens).toHaveLength(1)
    const reopen = required(surface.reopens[0], 'the reopen call')
    // The notice reopens the copy itself at the revision it was based on.
    expect(reopen.recovered).toBe(true)
    expect(reopen.document.documentId).toBe(surface.local.documentId)
    expect(reopen.document.headRevisionId).toBe(surface.local.baseRevisionId)
    expect(reopen.document.document).toEqual(surface.local.document)
    expect(surface.stub.calls).toEqual([])
  })
}
