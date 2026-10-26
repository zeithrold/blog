import type { GalleryAllocation } from '~/tests/components/support/media-boundary'
import { Buffer } from 'node:buffer'
import { failure } from '~/tests/components/support/http-fixtures'
import { serveGallery } from '~/tests/components/support/media-boundary'
import { assetFor } from '~/tests/components/support/media-fixtures'
import { mountSurface } from '~/tests/components/support/mount'
import { expect, test } from '~/tests/components/support/test'
import { assertAccessible } from '~/tests/support/browser/accessibility'

const payload = Buffer.from('Uploaded once')

function unknownCommittedOutcome() {
  const descriptors: number[] = []
  return {
    descriptors,
    descriptor: (read: number, allocation: GalleryAllocation) => {
      descriptors.push(read)
      return read === 1
        ? failure(503, 'CONNECTION_FAILED')
        : { body: assetFor(allocation.assetId, allocation.request) }
    },
    transfer: () => ({ abort: 'failed' as const }),
  }
}

test('unknown committed media outcome is accessible in zh dark mode at 320px', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 900 })
  const server = unknownCommittedOutcome()
  const gallery = await serveGallery(page, {
    descriptor: server.descriptor,
    transfer: server.transfer,
  })
  try {
    await mountSurface(page, { surface: 'media-gallery', locale: 'zh', mode: 'dark' })
    const trigger = page.getByRole('button', { name: '上传媒体', exact: true })
    await trigger.click()
    const dialog = page.getByRole('dialog', { name: '上传媒体', exact: true })
    const filename = `unknown-${crypto.randomUUID()}.txt`
    await page.getByLabel('媒体文件', { exact: true }).setInputFiles({
      name: filename,
      mimeType: 'text/plain',
      buffer: payload,
    })

    const row = dialog.getByRole('listitem').filter({ hasText: filename })
    await dialog.getByRole('button', { name: '上传文件', exact: true }).click()
    await expect(row).toHaveAttribute('data-state', 'failed')
    await expect(row.getByRole('alert')).toContainText('暂时无法确认上传结果')
    expect(server.descriptors).toEqual([1])

    await assertAccessible(page, info, { label: 'unknown-media-upload-zh-dark-320' })
    await gallery.api.expectServed()
  }
  finally {
    await gallery.api.dispose()
  }
})
