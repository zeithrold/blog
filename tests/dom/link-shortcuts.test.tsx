import { act } from 'react'
import { expect, it } from 'vitest'
import { button, click, field, press, typeText } from './dom'
import {
  buttonByName,
  dialogByName,
  dispatchShortcut,
  flushDraft,
  linkCopy,
  linkedContent,
  linkPrefix,
  linkSelected,
  linkSuffix,
  openShortcutLink,
  plainContent,
  revisionContent,
  revisionWrites,
  selectedRange,
  selectLinkText,
  waitForDOM,
} from './link-command-support'
import { editorBody, mountLinkEditor } from './link-harness'

for (const width of [
  320,
  390,
  1440,
]) {
  for (const locale of ['en', 'zh'] as const) {
    it(`Control+K and Meta+K open, cancel, save and Undo at ${width}px in ${locale}`, async () => {
      const labels = linkCopy[locale]
      const view = await mountLinkEditor({ width, locale })
      try {
        let expectedVersion = 0
        for (const modifier of ['Control', 'Meta'] as const) {
          await selectLinkText(view, selectedRange)
          const cancelled = await openShortcutLink(view, locale, modifier)
          act(() => typeText(field(cancelled, labels.url), `/posts/cancelled-${modifier.toLowerCase()}`))
          const writesBeforeCancel = revisionWrites(view).length
          act(() => click(button(cancelled, labels.cancel)))
          await waitForDOM(() => dialogByName(labels.dialog) === null)
          expect(revisionWrites(view)).toHaveLength(writesBeforeCancel)

          await selectLinkText(view, selectedRange)
          const escaped = await openShortcutLink(view, locale, modifier)
          const writesBeforeEscape = revisionWrites(view).length
          act(() => press(escaped, 'Escape'))
          await waitForDOM(() => dialogByName(labels.dialog) === null)
          expect(revisionWrites(view)).toHaveLength(writesBeforeEscape)

          await selectLinkText(view, selectedRange)
          const dialog = await openShortcutLink(view, locale, modifier)
          const href = `https://example.com/${modifier.toLowerCase()}`
          act(() => typeText(field(dialog, labels.url), href))
          // Clicking Save proves the DOM write. Synthetic Enter only reaches keydown;
          // jsdom does not perform implicit form submission, so native representatives own it.
          act(() => click(button(dialog, labels.save)))
          await waitForDOM(() => dialogByName(labels.dialog) === null)
          await flushDraft(view)
          revisionContent(view, linkedContent(href), expectedVersion++)

          const undo = buttonByName(view.container, labels.undo)
          if (undo === null) {
            throw new Error('The production editor toolbar has no Undo control')
          }
          act(() => click(undo))
          await waitForDOM(() => editorBody(view).querySelector('a') === null)
          await flushDraft(view)
          revisionContent(view, plainContent, expectedVersion++)
        }
      }
      finally {
        view.unmount()
      }
    })
  }
}

for (const { width, locale } of [
  { width: 1440, locale: 'en' },
  { width: 390, locale: 'en' },
  { width: 320, locale: 'zh' },
] as const) {
  it(`empty and composing selections suppress both link shortcuts at ${width}px in ${locale}`, async () => {
    const view = await mountLinkEditor({ width, locale })
    try {
      await selectLinkText(view, { start: selectedRange.start, end: selectedRange.start })
      for (const modifier of ['Control', 'Meta'] as const) {
        act(() => dispatchShortcut(view, modifier))
        expect(dialogByName(linkCopy[locale].dialog)).toBeNull()
      }
      await selectLinkText(view, selectedRange)
      act(() => {
        editorBody(view).dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
      })
      for (const modifier of ['Control', 'Meta'] as const) {
        act(() => dispatchShortcut(view, modifier))
        expect(dialogByName(linkCopy[locale].dialog)).toBeNull()
      }
      act(() => {
        editorBody(view).dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }))
      })
      expect(editorBody(view).textContent).toBe(`${linkPrefix}${linkSelected}${linkSuffix}`)
      expect(revisionWrites(view)).toEqual([])
      await view.api.expectServed()
    }
    finally {
      view.unmount()
    }
  })
}
