import type { FrontendPreferences } from '@/components/ui/ztd-me'
import type { Document } from '@/content/document'
import { File as NodeFile } from 'node:buffer'
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it } from 'vitest'
import { createPreferencePolicy } from '@/components/ui/ztd-me'
import { assetAllocationSchema, assetDescriptorSchema } from '@/contracts/media'
import { uploadMedia } from '@/features/editor/media/media-service'
import { CoverField } from '@/features/editor/workspace/cover-field'
import { BlogFrontend } from '@/i18n/frontend'
import { Client } from '@/shared/admin/api-client'
import { button, click, containing, field, one, press, typeText } from '~/tests/dom/shared/dom'
import { drainHostTask, installBrowserShims } from '~/tests/dom/shared/environment'
import { defer, serveFetch } from '~/tests/dom/shared/http'

type CoverUpdate = Document['meta']['cover']
const uploadedId = '914b268d-366c-4448-9f26-fdb699be231b'

const views: Array<() => void> = []

afterEach(() => {
  for (const unmount of views.splice(0)) {
    unmount()
  }
})

function asset(input: {
  filename: string
  role?: 'image' | 'file'
  state?: 'ready' | 'uploading'
  type?: string
  assetId?: string
}) {
  const assetId = input.assetId ?? crypto.randomUUID()
  return assetDescriptorSchema.parse({
    assetId,
    state: input.state ?? 'ready',
    url: `/assets/${assetId}`,
    filename: input.filename,
    type: input.type ?? 'image/png',
    bytes: 8,
    sha256: '0'.repeat(64),
    role: input.role ?? 'image',
  })
}

function library(options: { gate?: Promise<void>, failFirst?: boolean }): ReturnType<typeof serveFetch> {
  let attempts = 0
  const uploaded = asset({ filename: 'new-cover.png', assetId: uploadedId })
  return serveFetch({
    'POST /api/admin/assets': () => ({
      body: assetAllocationSchema.parse({
        assetId: uploadedId,
        state: 'uploading',
        uploadPath: `/api/admin/assets/${uploadedId}/content`,
      }),
    }),
    [`GET /api/admin/assets/${uploadedId}`]: () => ({ body: { ...uploaded, state: 'uploading' } }),
    [`PUT /api/admin/assets/${uploadedId}/content`]: async () => {
      await options.gate
      if (options.failFirst === true && attempts++ === 0) {
        return { status: 400, body: { code: 'ASSET_TYPE_MISMATCH' } }
      }
      return { body: uploaded }
    },
    'GET /api/admin/assets': () => ({
      body: {
        items: [
          asset({ filename: 'cover-ready.png' }),
          asset({
            filename: 'cover-uploading.png',
            state: 'uploading',
          }),
          asset({
            filename: 'document.txt',
            role: 'file',
            type: 'text/plain',
          }),
        ],
        nextCursor: null,
      },
    }),
  })
}

function mountHarness(container: HTMLElement, updates: CoverUpdate[], initial: CoverUpdate): void {
  const client = new Client('cover-csrf')
  function Harness() {
    const [cover, setCover] = useState<CoverUpdate>(initial)
    return (
      <>
        <CoverField
          value={cover}
          busy={false}
          run={() => {}}
          upload={async (file, signal) => await uploadMedia(client, file, 'image', signal)}
          update={(next) => {
            updates.push(next)
            setCover(next)
          }}
        />
        <output data-cover>{JSON.stringify(cover ?? null)}</output>
      </>
    )
  }
  const root = createRoot(container)
  const initialPreferences: FrontendPreferences = {
    version: 1,
    mode: 'light',
    palette: 'neutral',
    locale: 'en',
  }
  act(() => {
    root.render(
      <BlogFrontend
        initialPreferences={initialPreferences}
        policy={createPreferencePolicy({
          name: 'blog.dom.cover.v1',
          secure: false,
        })}
      >
        <Harness />
      </BlogFrontend>,
    )
  })
  views.push(() => {
    act(() => root.unmount())
    container.remove()
  })
}

function mountCoverField(options: {
  initial?: CoverUpdate
  gate?: Promise<void>
  failFirst?: boolean
} = {}): {
  container: HTMLElement
  updates: CoverUpdate[]
  api: ReturnType<typeof serveFetch>
} {
  installBrowserShims()
  const api = library(options)
  const updates: CoverUpdate[] = []
  const container = document.createElement('div')
  document.body.append(container)
  mountHarness(container, updates, options.initial ?? null)
  return { container, updates, api }
}

it('chooses a ready image from the media library, edits its description and clears it', async () => {
  const { container, updates, api } = mountCoverField()
  expect(container.querySelector('.cover-preview img')).toBeNull()

  act(() => {
    click(button(container, 'Choose cover'))
  })
  press(button(document.body, 'Media library'), 'Enter')
  await act(async () => {
    await api.settle()
  })
  await act(async () => {
    await drainHostTask()
  })
  expect(document.body.textContent).toContain('cover-ready.png')
  const dialog = one(document.body, '[data-slot="dialog-content"]')
  expect(dialog.textContent).not.toContain('document.txt')
  const uploadingCard = containing(dialog, '.editor-media-card', 'cover-uploading.png')
  expect(one<HTMLButtonElement>(uploadingCard, 'button').disabled).toBe(true)

  act(() => {
    click(one(containing(dialog, '.editor-media-card', 'cover-ready.png'), 'button'))
  })
  const selected = updates.at(-1)
  if (selected === null || selected === undefined) {
    throw new Error('Selecting a cover did not update the metadata')
  }
  expect(typeof selected.assetId).toBe('string')
  expect(selected.alt).toBe('')
  const preview = one<HTMLImageElement>(container, '.cover-preview img')
  expect(preview.getAttribute('src')).toBe(`/api/admin/assets/${selected.assetId}/content`)
  expect(button(container, 'Change cover')).toBeTruthy()

  typeText(field(container, 'Cover description'), 'A quiet desk at dusk')
  expect(updates.at(-1)).toEqual({
    assetId: selected.assetId,
    alt: 'A quiet desk at dusk',
  })
  expect(one<HTMLInputElement>(container, 'input').value).toBe('A quiet desk at dusk')

  act(() => {
    click(button(container, 'Remove cover'))
  })
  expect(updates.at(-1)).toBeNull()
  expect(container.querySelector('.cover-preview img')).toBeNull()
  expect(button(container, 'Choose cover')).toBeTruthy()
  expect(one(container, '[data-cover]').textContent).toBe('null')
})

function chooseFile(dialog: HTMLElement): void {
  const input = one<HTMLInputElement>(dialog, 'input[type="file"]')
  expect(input.multiple).toBe(false)
  expect(input.accept).toContain('.png')
  Object.defineProperty(input, 'files', {
    configurable: true,
    value: [
      new NodeFile(['image'], 'new-cover.png', { type: 'image/png' }),
    ],
  })
  act(() => {
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

it('uploads one image as the cover and prevents dismissal until upload completes', async () => {
  const gate = defer()
  const { container, updates, api } = mountCoverField({ gate: gate.promise })
  act(() => click(button(container, 'Choose cover')))
  const dialog = one(document.body, '[data-slot="dialog-content"]')
  expect(one(dialog, '[role="tab"][data-state="active"]').textContent).toBe('Direct upload')
  chooseFile(dialog)
  await act(async () => {
    click(button(one(dialog, '.media-upload-actions'), 'Upload files'))
    await drainHostTask()
  })
  expect(button(dialog, 'Close').disabled).toBe(true)
  expect(button(dialog, 'Media library').disabled).toBe(true)
  press(dialog, 'Escape')
  expect(document.body.contains(dialog)).toBe(true)
  await act(async () => {
    gate.open()
    await api.settle()
  })
  expect(updates.at(-1)).toEqual({ assetId: uploadedId, alt: '' })
  expect(one<HTMLImageElement>(container, '.cover-preview img').getAttribute('src'))
    .toBe(`/api/admin/assets/${uploadedId}/content`)
  expect(document.body.querySelector('[data-slot="dialog-content"]')).toBeNull()
})

it('keeps the existing cover on upload failure and preserves its description after retry', async () => {
  const original = { assetId: '0fefef2b-8b5b-4bf7-abd1-dfd4f52b9da8', alt: 'Original cover description' }
  const { container, updates, api } = mountCoverField({ initial: original, failFirst: true })
  act(() => click(button(container, 'Change cover')))
  const dialog = one(document.body, '[data-slot="dialog-content"]')
  chooseFile(dialog)
  await act(async () => {
    click(button(one(dialog, '.media-upload-actions'), 'Upload files'))
    await api.settle()
  })
  expect(one(dialog, '.media-upload-item').getAttribute('data-state')).toBe('failed')
  expect(updates).toEqual([])
  expect(one<HTMLInputElement>(container, 'input').value).toBe(original.alt)
  await act(async () => {
    click(button(dialog, 'Retry'))
    await api.settle()
  })
  expect(updates.at(-1)).toEqual({ assetId: uploadedId, alt: original.alt })
  expect(one<HTMLImageElement>(container, '.cover-preview img').getAttribute('src'))
    .toBe(`/api/admin/assets/${uploadedId}/content`)
})
