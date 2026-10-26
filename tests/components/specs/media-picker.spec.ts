import type { Locator, Page } from '@playwright/test'
import type { ComponentMode } from '~/tests/components/src/contract'
import type { ApiCall } from '~/tests/components/support/http-fixtures'
import type { MediaLedger } from '~/tests/components/support/media-boundary'
import type { MediaAsset } from '~/tests/components/support/media-fixtures'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { editorWorkspaceDocument, editorWorkspaceSaveAck } from '~/tests/components/support/editor-workspace-fixtures'
import { editorReady, mountEditorWorkspace } from '~/tests/components/support/editor-workspace-ui'
import { editorWorkspaceCopy } from '~/tests/components/support/expected-copy'
import { mediaHandlers, mediaLedger, serveMediaPreviews } from '~/tests/components/support/media-boundary'
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
        // The library lists the case's declared server fixtures; upload queue state
        // is proved by the DOM layer.
        listing: () => ledger.allocations.map(entry => assetFor(entry.assetId, entry.request)),
      }),
      'PUT /api/admin/documents/:id/revisions': call => editorWorkspaceSaveAck(call),
    },
  })
  // Registered after the case's API route so the private bytes answer first.
  await serveMediaPreviews(page, { ledger })
  await editorReady(page, locale)
  await page.getByRole('button', { name: copy[locale].add, exact: true }).click()
  const dialog = page.getByRole('dialog', { name: copy[locale].dialog, exact: true })
  await expect(dialog).toBeVisible()
  return { api, dialog }
}

function seedListedAsset(
  ledger: MediaLedger,
  input: {
    filename: string
    role: 'image' | 'file'
    type: string
    contents: string
  },
): MediaAsset {
  const assetId = crypto.randomUUID()
  const bytes = Buffer.from(input.contents)
  const request = {
    filename: input.filename,
    role: input.role,
    type: input.type,
    bytes: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  }
  const asset = assetFor(assetId, request)
  ledger.allocations.push({ assetId, request })
  ledger.assets.set(assetId, asset)
  return asset
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
    const ledger = mediaLedger()
    const prefix = `picker-${width}`
    const filename = `${prefix}-photo.png`
    const picked = seedListedAsset(ledger, {
      filename,
      role: 'image',
      type: 'image/png',
      contents: 'Existing image fixture',
    })
    seedListedAsset(ledger, {
      filename: `${prefix}-notes.txt`,
      role: 'file',
      type: 'text/plain',
      contents: 'A private file',
    })
    const { api, dialog } = await openPicker(page, { locale, mode, width, ledger })
    try {
      await dialog.getByRole('tab', { name: text.libraryTab, exact: true }).click()
      const card = dialog.locator('.editor-media-card').filter({ hasText: filename })
      await expect(card.locator('img')).toBeVisible()
      await withinViewport(page, dialog)
      expect(await card.locator('img').evaluate(element => getComputedStyle(element).objectFit)).toBe('contain')
      expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
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

      await expect.poll(() => revisions(api).length).toBeGreaterThan(0)
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
    const ledger = mediaLedger()
    const { api, dialog } = await openPicker(page, { locale, mode, width, ledger })
    try {
      await assertPickerLayout(page, dialog)
      await page.screenshot({ path: info.outputPath('upload-dialog.png') })

      // The real file chooser opens from both pointer and keyboard activation.
      const file = { name: 'picker-pointer.txt', mimeType: 'text/plain', buffer: Buffer.from('Pointer upload') }
      const pointer = page.waitForEvent('filechooser')
      await dialog.locator('.file-picker-control').click()
      await (await pointer).setFiles(file)
      const input = dialog.locator('input[type="file"]')
      await input.focus()
      const keyboard = page.waitForEvent('filechooser')
      await page.keyboard.press('Space')
      await (await keyboard).setFiles({ ...file, name: 'picker-keyboard.txt', buffer: Buffer.from('Keyboard upload') })
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}
