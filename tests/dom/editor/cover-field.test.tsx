import type { FrontendPreferences } from '@/components/ui/ztd-me'
import type { Document } from '@/content/document'
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it } from 'vitest'
import { createPreferencePolicy } from '@/components/ui/ztd-me'
import { assetDescriptorSchema } from '@/contracts/media'
import { CoverField } from '@/features/editor/workspace/cover-field'
import { BlogFrontend } from '@/i18n/frontend'
import { button, click, containing, field, one, typeText } from '~/tests/dom/shared/dom'
import { drainHostTask, installBrowserShims } from '~/tests/dom/shared/environment'
import { serveFetch } from '~/tests/dom/shared/http'

type CoverUpdate = Document['meta']['cover']

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
}) {
  const assetId = crypto.randomUUID()
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

function library(): ReturnType<typeof serveFetch> {
  return serveFetch({
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

function mountHarness(container: HTMLElement, updates: CoverUpdate[]): void {
  function Harness() {
    const [cover, setCover] = useState<CoverUpdate>(null)
    return (
      <>
        <CoverField
          value={cover}
          busy={false}
          run={() => {}}
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

function mountCoverField(): {
  container: HTMLElement
  updates: CoverUpdate[]
  api: ReturnType<typeof serveFetch>
} {
  installBrowserShims()
  const api = library()
  const updates: CoverUpdate[] = []
  const container = document.createElement('div')
  document.body.append(container)
  mountHarness(container, updates)
  return { container, updates, api }
}

it('chooses a ready image from the media library, edits its description and clears it', async () => {
  const { container, updates, api } = mountCoverField()
  expect(container.querySelector('.cover-preview img')).toBeNull()

  act(() => {
    click(button(container, 'Choose cover'))
  })
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
