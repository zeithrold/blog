import type { MountedGallery } from './media-support'
import { createHash } from 'node:crypto'
import { act } from 'react'
import { afterEach, expect, it } from 'vitest'
import { UUID } from '@/content/base'
import { all, button, click, field } from './dom'
import { until } from './environment'
import { failure, lostResponse } from './http'
import {
  mediaAsset,
  mediaFile,
  mediaGalleryHandlers,
  mountMediaGallery,
  resetMediaDom,
  selectFiles,
} from './media-support'

afterEach(resetMediaDom)

const payload = 'Uploaded once'

const scenarios = [
  { outcome: 'committed', locale: 'zh-CN', retry: '重试', expectedTransfers: 1 },
  { outcome: 'disconnected', locale: 'en', retry: 'Retry', expectedTransfers: 2 },
  { outcome: 'csrf-renewal', locale: 'en', retry: 'Retry', expectedTransfers: 3 },
] as const

type TransferScenario = (typeof scenarios)[number]

function transferHandlers(scenario: TransferScenario, asset: ReturnType<typeof mediaAsset>) {
  return mediaGalleryHandlers({
    uploadAssets: [asset],
    descriptor: (ready, _call, read) => {
      if (scenario.outcome === 'committed' && read === 1) {
        return failure(503, 'CONNECTION_FAILED')
      }
      return {
        body: scenario.outcome === 'committed'
          ? ready
          : { ...ready, state: 'uploading' },
      }
    },
    transfer: (ready, _call, attempt) => {
      if (attempt === 1) {
        return lostResponse()
      }
      if (scenario.outcome === 'csrf-renewal' && attempt === 2) {
        return failure(403, 'CSRF_INVALID')
      }
      return { body: ready }
    },
  })
}

async function beginTransfer(
  view: MountedGallery,
  scenario: TransferScenario,
  filename: string,
): Promise<HTMLElement> {
  await act(async () => {
    await until(() => view.session.snapshot().loaded)
  })
  const trigger = scenario.locale === 'en' ? 'Upload media' : '上传媒体'
  const uploadFiles = scenario.locale === 'en' ? 'Upload files' : '上传文件'
  act(() => click(button(view.container, trigger)))
  const dialog = document.body.querySelector('[role="dialog"]')
  if (dialog === null) {
    throw new Error('The upload dialog did not open')
  }
  const input = field(dialog, scenario.locale === 'en' ? 'Media file' : '媒体文件')
  if (!(input instanceof HTMLInputElement)) {
    throw new TypeError('The media file control is not an input')
  }
  selectFiles(input, [
    mediaFile(filename, 'text/plain', payload),
  ])
  act(() => click(button(dialog, uploadFiles)))
  await act(async () => {
    await until(() => all(dialog, '.media-upload-item[data-state="failed"]').length === 1)
  })
  const row = all<HTMLElement>(dialog, '.media-upload-item')[0]
  if (row === undefined) {
    throw new Error('The failed transfer row did not render')
  }
  return row
}

async function retryTransfer(
  view: MountedGallery,
  row: HTMLElement,
  retryLabel: string,
): Promise<void> {
  act(() => click(button(row, retryLabel)))
  await act(async () => {
    await until(() => row.getAttribute('data-state') === 'complete')
    await view.api.expectServed()
  })
}

function expectTransferRequests(
  view: MountedGallery,
  filename: string,
  assetId: string,
  expectedTransfers: number,
): void {
  const allocations = view.api.calls.filter(call => call.method === 'POST')
  expect(allocations).toHaveLength(1)
  expect(allocations[0]?.json).toEqual({
    filename,
    role: 'file',
    type: 'text/plain',
    bytes: payload.length,
    sha256: createHash('sha256').update(payload).digest('hex'),
  })
  UUID.parse(allocations[0]?.headers['idempotency-key'] ?? '')

  const descriptors = view.api.calls.filter(call => call.method === 'GET'
    && call.path === `/api/admin/assets/${assetId}`)
  expect(descriptors).toHaveLength(2)
  const transfers = view.api.calls.filter(call => call.method === 'PUT')
  expect(transfers).toHaveLength(expectedTransfers)
  expect(transfers.every(call => call.path === `/api/admin/assets/${assetId}/content`))
    .toBe(true)
}

for (const scenario of scenarios) {
  it(`media retry reuses its upload allocation after a ${scenario.outcome} transfer`, async () => {
    const filename = `recover-${scenario.outcome}.txt`
    const asset = mediaAsset({
      assetId: '2aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      filename,
      role: 'file',
      type: 'text/plain',
      bytes: payload.length,
    })
    const view = mountMediaGallery(
      transferHandlers(scenario, asset),
      { locale: scenario.locale },
    )
    const row = await beginTransfer(view, scenario, filename)
    if (scenario.outcome === 'committed') {
      expect(row.textContent).toContain('暂时无法确认上传结果')
    }
    await retryTransfer(view, row, scenario.retry)
    expect(row.getAttribute('data-state')).toBe('complete')
    expect(row.textContent).toContain('13 B')
    expectTransferRequests(view, filename, asset.assetId, scenario.expectedTransfers)
  })
}
