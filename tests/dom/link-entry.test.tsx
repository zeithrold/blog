import { act } from 'react'
import { expect, it } from 'vitest'
import { all, button, click, field, typeText } from './dom'
import {
  buttonByName,
  destinations,
  dialogByName,
  dispatchShortcut,
  invalidDestinations,
  linkCopy,
  linkedContent,
  openShortcutLink,
  openToolbarLink,
  plainContent,
  revisionContent,
  revisionWrites,
  selectedRange,
  waitForDOM,
} from './link-command-support'
import { editorBody, mountLinkEditor } from './link-harness'
import { flushDraft, selectLinkText } from './link-harness-interactions'

for (const { entry, width, locale } of [
  { entry: 'keyboard', width: 1440, locale: 'en' },
  { entry: 'toolbar', width: 390, locale: 'en' },
  { entry: 'keyboard', width: 320, locale: 'zh' },
  { entry: 'toolbar', width: 320, locale: 'zh' },
] as const) {
  it(`${entry} refuses invalid destinations without a revision at ${width}px in ${locale}`, async () => {
    const view = await mountLinkEditor({ width, locale })
    try {
      await selectLinkText(view, selectedRange)
      const dialog = entry === 'keyboard'
        ? await openShortcutLink(view, locale, 'Control')
        : await openToolbarLink(view, locale, width)
      const url = field(dialog, linkCopy[locale].url)
      for (const value of invalidDestinations) {
        act(() => typeText(url, value))
        act(() => click(button(dialog, linkCopy[locale].save)))
        await waitForDOM(() => url.getAttribute('aria-invalid') === 'true')
        expect(all(dialog, '[role="alert"]')[0]?.textContent).toContain(linkCopy[locale].invalid)
        expect(editorBody(view).querySelectorAll('a')).toHaveLength(0)
        expect(revisionWrites(view)).toEqual([])
      }
      act(() => click(button(dialog, linkCopy[locale].cancel)))
      await waitForDOM(() => dialogByName(linkCopy[locale].dialog) === null)
      await view.api.expectServed()
    }
    finally {
      view.unmount()
    }
  })
}

it('a corrected bare domain saves after refusals at 390px in zh', async () => {
  const view = await mountLinkEditor({ width: 390, locale: 'zh' })
  try {
    await selectLinkText(view, selectedRange)
    const dialog = await openShortcutLink(view, 'zh', 'Meta')
    const url = field(dialog, linkCopy.zh.url)
    for (const invalid of ['', 'https://exa mple.com']) {
      act(() => typeText(url, invalid))
      act(() => click(button(dialog, linkCopy.zh.save)))
      await waitForDOM(() => url.getAttribute('aria-invalid') === 'true')
      expect(all(dialog, '[role="alert"]')[0]?.textContent).toContain(linkCopy.zh.invalid)
      expect(revisionWrites(view)).toEqual([])
      expect(editorBody(view).querySelectorAll('a')).toHaveLength(0)
    }
    act(() => typeText(url, 'example.com'))
    act(() => click(button(dialog, linkCopy.zh.save)))
    await waitForDOM(() => dialogByName(linkCopy.zh.dialog) === null)
    await waitForDOM(() => editorBody(view).querySelector('a')?.getAttribute('href') === 'https://example.com')
    await flushDraft(view)
    revisionContent(view, linkedContent('https://example.com'), 0)
  }
  finally {
    view.unmount()
  }
})

for (const { entry, width, locale } of [
  { entry: 'keyboard', width: 1440, locale: 'en' },
  { entry: 'toolbar', width: 390, locale: 'en' },
  { entry: 'keyboard', width: 320, locale: 'zh' },
  { entry: 'toolbar', width: 320, locale: 'zh' },
] as const) {
  it(`${entry} normalizes destinations and Undo restores the range at ${width}px in ${locale}`, async () => {
    const view = await mountLinkEditor({ width, locale })
    try {
      let expectedVersion = 0
      for (const destination of destinations) {
        await selectLinkText(view, selectedRange)
        const dialog = entry === 'keyboard'
          ? await openShortcutLink(view, locale, 'Control')
          : await openToolbarLink(view, locale, width)
        act(() => typeText(field(dialog, linkCopy[locale].url), destination.input))
        act(() => click(button(dialog, linkCopy[locale].save)))
        await waitForDOM(() => dialogByName(linkCopy[locale].dialog) === null)
        await waitForDOM(() => editorBody(view).querySelector('a')?.getAttribute('href') === destination.href)
        await flushDraft(view)
        revisionContent(view, linkedContent(destination.href), expectedVersion++)

        const undo = buttonByName(view.container, linkCopy[locale].undo)
        if (undo === null) {
          throw new Error('The production editor toolbar has no Undo control')
        }
        act(() => click(undo))
        await waitForDOM(() => editorBody(view).querySelector('a') === null)
        await flushDraft(view)
        revisionContent(view, plainContent, expectedVersion++)
      }
      await view.api.expectServed()
    }
    finally {
      view.unmount()
    }
  })
}

it('the desktop shortcut reuses one dialog and Cancel leaves the revision unchanged', async () => {
  const view = await mountLinkEditor()
  try {
    await selectLinkText(view, selectedRange)
    const dialog = await openShortcutLink(view, 'en', 'Control')
    expect(all(document.body, '[role="dialog"]')).toHaveLength(1)
    dispatchShortcut(view, 'Control')
    expect(all(document.body, '[role="dialog"]')).toHaveLength(1)
    act(() => click(button(dialog, linkCopy.en.cancel)))
    await waitForDOM(() => dialogByName(linkCopy.en.dialog) === null, 'the Cancelled link dialog to close')
    expect(revisionWrites(view)).toEqual([])
    await view.api.expectServed()
  }
  finally {
    view.unmount()
  }
})

it('the compact formatting drawer hands its selection to the link dialog and saves the request', async () => {
  const view = await mountLinkEditor({ width: 390 })
  try {
    await selectLinkText(view, selectedRange)
    const dialog = await openToolbarLink(view, 'en', 390)
    act(() => typeText(field(dialog, linkCopy.en.url), '/posts/drawer'))
    act(() => click(button(dialog, linkCopy.en.save)))
    await waitForDOM(() => dialogByName(linkCopy.en.dialog) === null)
    await waitForDOM(() => editorBody(view).querySelector('a')?.getAttribute('href') === '/posts/drawer')
    await flushDraft(view)
    revisionContent(view, linkedContent('/posts/drawer'), 0)
  }
  finally {
    view.unmount()
  }
})
