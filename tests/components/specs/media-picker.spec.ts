import type { Locator, Page } from '@playwright/test'
import type { ComponentMode } from '~/tests/components/src/contract'
import type { ApiCall } from '~/tests/components/support/http-fixtures'
import type { MediaLedger } from '~/tests/components/support/media-boundary'
import { Buffer } from 'node:buffer'
import { editorWorkspaceDocument, editorWorkspaceSaveAck } from '~/tests/components/support/editor-workspace-fixtures'
import { editorReady, mountEditorWorkspace } from '~/tests/components/support/editor-workspace-ui'
import { editorWorkspaceCopy } from '~/tests/components/support/expected-copy'
import { mediaHandlers, serveMediaPreviews } from '~/tests/components/support/media-boundary'
import { assetFor } from '~/tests/components/support/media-fixtures'
import { expect, test } from '~/tests/components/support/test'
import { assertAccessible } from '~/tests/support/browser/accessibility'
import { horizontalBounds, withinViewport } from '~/tests/support/browser/layout'

/**
 * The editor's media picker on the real workspace surface: the shell, the lazy
 * editor entry, BlockNote and the media coordinator, with only the HTTP replies a
 * case declares. The picker, the insertion and the revision write are the product's
 * own; R2 storage, private routing and CSP stay with the Worker and the retained
 * browser case.
 */
const copy = {
  en: {
    add: 'Add media',
    dialog: 'Add media',
    uploadTab: 'Upload files',
    libraryTab: 'Media library',
    upload: 'Upload files',
    close: 'Close',
    mediaFile: 'Media file',
    open: 'Open media',
    use: 'Use media',
    saved: /^Saved$/,
  },
  zh: {
    add: '添加媒体',
    dialog: '添加媒体',
    uploadTab: '上传文件',
    libraryTab: '媒体库',
    upload: '上传文件',
    close: '关闭',
    mediaFile: '媒体文件',
    open: '打开媒体',
    use: '使用此媒体',
    saved: /^已保存$/,
  },
} as const

type Locale = keyof typeof copy

type PickerOptions = {
  locale: Locale
  mode: ComponentMode
  width: number
  ledger: MediaLedger
}

async function openPicker(page: Page, options: PickerOptions): Promise<{
  api: Awaited<ReturnType<typeof mountEditorWorkspace>>
  dialog: Locator
}> {
  const { locale, mode, width, ledger } = options
  const api = await mountEditorWorkspace(page, {
    document: editorWorkspaceDocument(`Media picker ${crypto.randomUUID()}`),
    width,
    locale,
    mode,
    writes: {
      ...mediaHandlers(ledger, {
        // The library tab lists what the server holds, so it reads back the very
        // allocations this case made; only the upload queue is client-side state.
        listing: () => ledger.allocations.map(entry => assetFor(entry.assetId, entry.request)),
      }),
      'PUT /api/admin/documents/:id/revisions': call => editorWorkspaceSaveAck(call),
    },
  })
  // Registered after the case's API route so the private bytes answer first.
  await serveMediaPreviews(page)
  await editorReady(page, locale)
  await page.getByRole('button', { name: copy[locale].add, exact: true }).click()
  const dialog = page.getByRole('dialog', { name: copy[locale].dialog, exact: true })
  await expect(dialog).toBeVisible()
  return { api, dialog }
}

async function uploadFile(
  dialog: Locator,
  locale: Locale,
  file: { name: string, mimeType: string, buffer: Buffer },
): Promise<void> {
  const text = copy[locale]
  await dialog.getByRole('tab', { name: text.uploadTab, exact: true }).click()
  await dialog.getByLabel(text.mediaFile, { exact: true }).setInputFiles(file)
  await dialog.getByRole('button', { name: text.upload, exact: true }).click()
  await expect(dialog.locator('.media-upload-item').filter({ hasText: file.name }))
    .toHaveAttribute('data-state', 'complete', { timeout: 15000 })
}

/** The writes the surface attempted, so a case can assert what was stored. */
function revisions(api: { calls: readonly ApiCall[] }): ApiCall[] {
  return api.calls.filter(call => call.method === 'PUT' && call.path.endsWith('/revisions'))
}

for (const [locale, mode, width] of [
  [
    'zh',
    'dark',
    320,
  ],
  [
    'zh',
    'light',
    390,
  ],
  [
    'en',
    'light',
    1440,
  ],
] as const) {
  test(`media cards preserve previews, keyboard selection and accessible layout at ${width}px`, async ({
    page,
  }, info) => {
    const text = copy[locale]
    const ledger: MediaLedger = { allocations: [], transfers: [] }
    const { api, dialog } = await openPicker(page, { locale, mode, width, ledger })
    try {
      const prefix = `picker-${width}`
      const filename = `${prefix}-photo.png`
      await uploadFile(dialog, locale, {
        name: filename,
        mimeType: 'image/png',
        buffer: await page.screenshot({ type: 'png' }),
      })
      await uploadFile(dialog, locale, {
        name: `${prefix}-notes.txt`,
        mimeType: 'text/plain',
        buffer: Buffer.from('A private file'),
      })

      await dialog.getByRole('tab', { name: text.libraryTab, exact: true }).click()
      const card = dialog.locator('.editor-media-card').filter({ hasText: filename })
      await expect(card.locator('img')).toBeVisible()
      await withinViewport(page, dialog)
      expect(await card.locator('img').evaluate(element => getComputedStyle(element).objectFit)).toBe('contain')
      expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
      const open = card.getByRole('link', { name: text.open, exact: true })
      await expect(open).toHaveAttribute('target', '_blank')
      const use = card.getByRole('button', { name: text.use, exact: true })
      await use.focus()
      await expect(use).toBeFocused()
      await assertAccessible(page, info, { label: `media-picker-${width}` })
      await page.screenshot({ path: info.outputPath(`media-picker-${width}.png`) })

      // The keyboard choice inserts the picked media, exactly as the browser case saw it.
      await use.press('Enter')
      await expect(dialog).toHaveCount(0)
      const body = page.getByLabel(editorWorkspaceCopy[locale].body, { exact: true })
      await expect(body.locator('img')).toHaveCount(2)
      await expect(page.getByRole('status').filter({ hasText: text.saved })).toBeVisible({ timeout: 15000 })

      const picked = ledger.allocations[0]
      if (picked === undefined) {
        throw new Error('The picker never allocated the chosen file')
      }
      expect(ledger.allocations).toHaveLength(2)
      const writes = revisions(api)
      expect(writes.length).toBeGreaterThan(0)
      // The stored block keeps the descriptor's public path; the private content
      // path is only what the editor previews it from.
      const stored = JSON.stringify(writes.at(-1)?.json)
      expect(stored).toContain(`/assets/${picked.assetId}`)
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}

async function assertPickerLayout(page: Page, dialog: Locator): Promise<void> {
  const picker = dialog.locator('.file-picker-control')
  await horizontalBounds(page, dialog)
  await horizontalBounds(page, picker)
  await expect(dialog.locator('input[type="file"]')).toHaveCSS('opacity', '0')
  await expect(dialog.locator('input[type="file"]')).toHaveCSS('position', 'absolute')
  await expect(picker).toHaveCSS('min-height', '44px')
  const geometry = await picker.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    const input = element.querySelector('input')?.getBoundingClientRect()
    const label = element.querySelector('span')?.getBoundingClientRect()
    return {
      width: bounds.width,
      height: bounds.height,
      fits: input !== undefined && input.left >= bounds.left && input.right <= bounds.right,
      labelHeight: label?.height,
      labelWidth: label?.width,
    }
  })
  expect(geometry.width).toBeLessThanOrEqual(240)
  expect(geometry.height).toBeLessThanOrEqual(48)
  expect(geometry.fits).toBe(true)
  expect(geometry.labelHeight).toBeLessThan(24)
  expect(geometry.labelWidth).toBeGreaterThan(48)
}

for (const [locale, mode, width] of [
  [
    'zh',
    'light',
    320,
  ],
  [
    'zh',
    'dark',
    682,
  ],
  [
    'en',
    'light',
    1440,
  ],
] as const) {
  test(`upload picker stays compact and supports pointer and keyboard at ${width}px`, async ({
    page,
  }, info) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const text = copy[locale]
    const ledger: MediaLedger = { allocations: [], transfers: [] }
    const { api, dialog } = await openPicker(page, { locale, mode, width, ledger })
    try {
      await assertPickerLayout(page, dialog)
      await page.screenshot({ path: info.outputPath('upload-dialog.png') })

      // A pointer selection and a keyboard selection both reach the queue.
      const file = { name: 'picker-pointer.txt', mimeType: 'text/plain', buffer: Buffer.from('Pointer upload') }
      const pointer = page.waitForEvent('filechooser')
      await dialog.locator('.file-picker-control').click()
      await (await pointer).setFiles(file)
      const input = dialog.locator('input[type="file"]')
      await input.focus()
      const keyboard = page.waitForEvent('filechooser')
      await page.keyboard.press('Space')
      await (await keyboard).setFiles({ ...file, name: 'picker-keyboard.txt', buffer: Buffer.from('Keyboard upload') })
      await expect(dialog.locator('.media-upload-item')).toHaveCount(2)

      await dialog.getByRole('button', { name: text.upload, exact: true }).click()
      await expect(dialog.locator('.media-upload-item[data-state="complete"]')).toHaveCount(2, { timeout: 15000 })
      await expect.poll(() => ledger.transfers.length).toBe(2)
      expect(ledger.allocations).toHaveLength(2)
      for (const allocation of ledger.allocations) {
        expect(ledger.transfers).toContain(`/api/admin/assets/${allocation.assetId}/content`)
      }
      await dialog.getByRole('button', { name: text.close, exact: true }).click()
      await expect(dialog).toHaveCount(0)
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}
