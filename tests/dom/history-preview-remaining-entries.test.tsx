import { afterEach, expect, it } from 'vitest'
import { mountContentSettings } from './history-preview-remaining-settings'
import {
  controlNamed,
  controlsWithin,
  elementByRole,
  elementsByRole,
  mountPreviewEntries,
  previewCopy,
  previewDialog,
  previewReader,
  reopenedText,
  required,
  savedText,
  settle,
  unexpectedMutationAttempts,
  unsavedText,
} from './history-preview-remaining-support'
import { click, pressKey, resetDomPage, visibleText } from './history-state-support'

/**
 * The draft preview both editor entries open, in jsdom.
 *
 * The Content tab's entry (`LivePreview`) and the action menu (`DocumentActions`)
 * are the product's two entries, mounted under one real `DraftPreviewProvider`.
 * The case proves they share one preview, that its reader renders the current
 * unsaved draft rather than the saved revision, that no error is shown and that
 * previewing sends no request at all. The BlockNote boundary that produces the
 * draft document is supplied by the harness; the live editor, the dialog's
 * geometry, focus return and the menu's real rendering stay in the browser case.
 */

const pageLocales = ['en', 'zh-CN'] as const

afterEach(() => {
  try {
    // A save, publish or delete the preview path attempted is a failure, even if the product swallowed it.
    expect(unexpectedMutationAttempts()).toEqual([])
  }
  finally {
    resetDomPage()
  }
})

/** Opens the action menu from its trigger the way a keyboard reader does. */
async function openActionMenu(trigger: HTMLElement): Promise<void> {
  await pressKey('ArrowDown', trigger)
  await settle(() => elementByRole('menu') !== null, 'the document action menu')
}

for (const locale of pageLocales) {
  const copy = previewCopy[locale]

  it(`offers exactly one draft preview entry in the content tab in ${locale}`, async () => {
    const surface = await mountContentSettings(locale)
    // The whole Content tab root, not one section, offers the entry once.
    const entries = controlsWithin(surface.root, copy.entry)
    expect(entries).toHaveLength(1)
    expect(surface.root.querySelectorAll('.editor-preview-actions')).toHaveLength(1)
    // The Content tab offers no saved-revision preview entry or preview-route link.
    expect(controlsWithin(surface.root, copy.savedRevision)).toEqual([])
    expect(surface.root.querySelector('a[href^="/admin/preview/"]')).toBeNull()
    // Mounting the tab reads nothing; revealing its catalog section reads both catalogs.
    expect(surface.stub.calls).toEqual([])
    await click(required(controlNamed(copy.catalog), 'the catalog disclosure'))
    await settle(() => surface.stub.calls.length === 2, 'the two catalog reads')
    expect(surface.stub.calls.map(call => `${call.method} ${call.path}`).sort())
      .toEqual(['GET /api/admin/catalog/series', 'GET /api/admin/catalog/tag'].sort())
    expect(surface.stub.calls.filter(call => call.method !== 'GET')).toEqual([])
    // The entry opens the one preview dialog this surface owns and adds no request.
    await click(required(entries[0], 'the Content tab preview entry'))
    expect(elementsByRole('dialog', copy.dialog)).toHaveLength(1)
    expect(surface.stub.calls).toHaveLength(2)
  })

  it(`opens one draft preview from the content tab and the action menu in ${locale}`, async () => {
    const surface = await mountPreviewEntries(locale)
    const content = required(controlNamed(copy.entry), 'the Content tab preview entry')
    await click(content)
    const fromContent = required(previewDialog(copy.dialog), 'the draft preview dialog')
    // Both entries are served by one provider, so exactly one dialog exists.
    expect(elementsByRole('dialog')).toHaveLength(1)
    expect(elementsByRole('dialog', copy.dialog)).toHaveLength(1)
    await settle(() => {
      const reader = previewReader(fromContent, copy.reader)
      return reader !== null && visibleText(reader).includes(unsavedText)
    }, 'the unsaved draft in the reader')
    const reader = required(previewReader(fromContent, copy.reader), 'the draft reader region')
    // The reader renders this window's unsaved draft, not the saved revision.
    expect(visibleText(reader)).not.toContain(savedText)
    // The draft is complete, so the preview shows no error.
    expect(fromContent.querySelector('[role="alert"]')).toBeNull()
    await click(required(controlNamed(copy.close), 'the close preview control'))
    // Closing the preview removes the only dialog it owned.
    expect(elementsByRole('dialog')).toHaveLength(0)

    const more = required(controlNamed(copy.more), 'the document actions trigger')
    await openActionMenu(more)
    const items = elementsByRole('menuitem', copy.entry)
    expect(items).toHaveLength(1)
    await click(required(items[0], 'the preview menu item'))
    await settle(() => {
      const dialog = previewDialog(copy.dialog)
      return dialog !== null && visibleText(previewReader(dialog, copy.reader)).includes(unsavedText)
    }, 'the action menu preview')
    // The menu closes behind the same single preview.
    expect(elementByRole('menu')).toBeNull()
    expect(elementsByRole('dialog')).toHaveLength(1)
    // The menu ran no action and the provider attempted no save.
    expect(surface.flights).toEqual([])
    // Previewing is a read: neither entry sent a request, so it could not publish.
    expect(surface.stub.calls).toEqual([])
  })

  it(`opens one draft preview from the compact action drawer in ${locale}`, async () => {
    const surface = await mountPreviewEntries(locale, 'compact')
    const more = required(controlNamed(copy.more), 'the compact document actions trigger')
    await click(more)
    // The compact layout renders the product's own action drawer, whose entries are buttons.
    const drawer = required(elementByRole('dialog', copy.more), 'the compact action drawer')
    const items = controlsWithin(drawer, copy.entry)
    expect(items).toHaveLength(1)
    await click(required(items[0], 'the compact preview action'))
    await settle(() => {
      const dialog = previewDialog(copy.dialog)
      return dialog !== null && visibleText(previewReader(dialog, copy.reader)).includes(unsavedText)
    }, 'the compact drawer preview')
    // The drawer closes behind the same single preview.
    expect(elementByRole('dialog', copy.more)).toBeNull()
    expect(elementsByRole('dialog', copy.dialog)).toHaveLength(1)
    expect(surface.flights).toEqual([])
    expect(surface.stub.calls).toEqual([])
  })

  it(`closes the draft preview and reopens it with the current draft in ${locale}`, async () => {
    const surface = await mountPreviewEntries(locale)
    const content = required(controlNamed(copy.entry), 'the Content tab preview entry')
    await click(content)
    await settle(() => {
      const dialog = previewDialog(copy.dialog)
      return dialog !== null && visibleText(previewReader(dialog, copy.reader)).includes(unsavedText)
    }, 'the unsaved draft in the reader')
    await click(required(controlNamed(copy.close), 'the close preview control'))
    expect(elementsByRole('dialog')).toHaveLength(0)
    // The next open reads the editor snapshot again, not the document it showed before.
    surface.edit(reopenedText)
    await click(content)
    await settle(() => {
      const dialog = previewDialog(copy.dialog)
      return dialog !== null && visibleText(previewReader(dialog, copy.reader)).includes(reopenedText)
    }, 'the current draft after the edit')
    expect(surface.snapshots()).toBe(2)
    expect(surface.stub.calls).toEqual([])
  })
}
