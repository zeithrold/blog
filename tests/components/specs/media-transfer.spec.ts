import type { GalleryAllocation } from '~/tests/components/support/media-boundary'
import type { ComponentLocale, ComponentMode } from '~/tests/components/support/mount'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { UUID } from '@/content/base'
import { failure } from '~/tests/components/support/http-fixtures'
import { serveGallery } from '~/tests/components/support/media-boundary'
import { assetFor } from '~/tests/components/support/media-fixtures'
import { mountSurface } from '~/tests/components/support/mount'
import { expect, test } from '~/tests/components/support/test'
import { assertAccessible } from '~/tests/support/browser/accessibility'

type Outcome = 'committed' | 'disconnected' | 'csrf-renewal'

// The retry paths are the same three the upload client keeps apart, so each case
// mounts the locale and mode the old browser case reached by switching preferences.
const scenarios: readonly {
  outcome: Outcome
  locale: ComponentLocale
  mode: ComponentMode
  width: number
  /** Attempts the client makes for one retry: resumed, or resumed plus a CSRF renewal. */
  attempts: number
}[] = [
  { outcome: 'committed', locale: 'zh', mode: 'dark', width: 320, attempts: 1 },
  { outcome: 'disconnected', locale: 'en', mode: 'light', width: 1440, attempts: 2 },
  { outcome: 'csrf-renewal', locale: 'en', mode: 'light', width: 1440, attempts: 3 },
]

const copy = {
  en: { trigger: 'Upload media', upload: 'Upload files', retry: 'Retry', fileName: 'Media file' },
  zh: { trigger: '上传媒体', upload: '上传文件', retry: '重试', fileName: '媒体文件' },
} as const

const payload = Buffer.from('Uploaded once')
const sha256 = createHash('sha256').update(payload).digest('hex')

/** The two reads every retry makes: the attempt that failed, and the retry itself. */
const recoveryReads = 2

/**
 * What the fixture's server did with the transfer that failed, and what it reports
 * from then on. The stored-and-ready row an unknown outcome leaves behind is real
 * server state: `tests/integration/asset-allocation.integration.ts` proves one
 * allocation is one row that replays for the same key, and
 * `tests/integration/full-services.integration.ts` proves the ready descriptor and
 * streamed bytes. Here the descriptor is what a retry reads back.
 */
function serverFor(outcome: Outcome) {
  const descriptors: number[] = []
  return {
    descriptors,
    descriptor: (read: number, allocation: GalleryAllocation) => {
      descriptors.push(read)
      if (outcome === 'committed') {
        // The bytes were stored, but the first read cannot see that yet.
        return read === 1
          ? failure(503, 'CONNECTION_FAILED')
          : { body: assetFor(allocation.assetId, allocation.request) }
      }
      // The interrupted asset is still uploading, so the retry resumes its own path.
      return { body: assetFor(allocation.assetId, allocation.request, 'uploading') }
    },
    transfer: (attempt: number, allocation: GalleryAllocation) => {
      if (attempt === 1) {
        return { abort: 'failed' as const }
      }
      if (outcome === 'csrf-renewal' && attempt === 2) {
        return failure(403, 'CSRF_INVALID')
      }
      return { body: assetFor(allocation.assetId, allocation.request) }
    },
  }
}

for (const { outcome, locale, mode, width, attempts } of scenarios) {
  test(`media retry reuses its upload allocation after a ${outcome} transfer`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 })
    const server = serverFor(outcome)
    const gallery = await serveGallery(page, {
      descriptor: server.descriptor,
      transfer: server.transfer,
    })
    try {
      await mountSurface(page, { surface: 'media-gallery', locale, mode })
      const text = copy[locale]
      await page.getByRole('button', { name: text.trigger, exact: true }).click()
      const dialog = page.getByRole('dialog', { name: text.trigger, exact: true })
      const filename = `recover-${crypto.randomUUID()}.txt`
      await page.getByLabel(text.fileName, { exact: true }).setInputFiles({
        name: filename,
        mimeType: 'text/plain',
        buffer: payload,
      })
      const row = dialog.getByRole('listitem').filter({ hasText: filename })
      await dialog.getByRole('button', { name: text.upload, exact: true }).click()
      await expect(row).toHaveAttribute('data-state', 'failed')
      if (outcome === 'committed') {
        // An unknown outcome must say so instead of claiming a failure.
        await expect(row.getByRole('alert')).toContainText('暂时无法确认上传结果')
        await assertAccessible(page, info, { label: 'unknown-media-upload-zh-dark-320' })
      }

      await row.getByRole('button', { name: text.retry, exact: true }).click()
      await expect(row).toHaveAttribute('data-state', 'complete')
      await expect(row).toContainText('13 B')

      // The client contract the retry keeps: one allocation for the attempt and its
      // retry, counted from the requests themselves, and the exact allocate body.
      expect(gallery.allocations).toHaveLength(1)
      const [allocation] = gallery.allocations
      if (allocation === undefined) {
        throw new Error('The surface never allocated an asset')
      }
      expect(allocation.request).toEqual({
        filename,
        role: 'file',
        type: 'text/plain',
        bytes: payload.byteLength,
        sha256,
      })
      const allocate = gallery.api.calls.filter(call => call.method === 'POST')
      expect(allocate).toHaveLength(1)
      UUID.parse(allocate[0]?.headers['idempotency-key'])

      // Every transfer reaches the allocation's own path, so a retry can never
      // upload somewhere the first attempt did not.
      const content = `/api/admin/assets/${allocation.assetId}/content`
      expect(gallery.transfers).toEqual(Array.from({ length: attempts }).fill(content))
      expect(server.descriptors).toHaveLength(recoveryReads)
      await gallery.api.expectServed()
    }
    finally {
      await gallery.api.dispose()
    }
  })
}
