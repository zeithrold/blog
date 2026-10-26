/* eslint-disable react-refresh/only-export-components -- Test support, not a Fast Refresh boundary. */
import type { ReactNode } from 'react'
import type { ApiCall, ApiHandler, ApiReply, ApiService } from './http'
import type { FrontendPreferences } from '@/components/ui/ztd-me'
import type { EditorUploadModel } from '@/features/editor/media/editor-upload-model'
import type { Workspace } from '@/features/editor/workspace/editor-types'
import type { MediaAsset, MediaRole, UploadRole } from '@/features/media/media-types'
import { act, useState, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import { createPreferencePolicy } from '@/components/ui/ztd-me'
import {
  allocateAssetSchema,
  assetAllocationSchema,
  assetDescriptorSchema,
  assetListSchema,
} from '@/contracts/media'
import { sessionSchema } from '@/contracts/session'
import { uploadMedia } from '@/features/editor/media/media-service'
import { EditorMediaOverlay } from '@/features/editor/media/media-upload'
import { GallerySession } from '@/features/media/gallery-session'
import { MediaManager } from '@/features/media/media'
import { MediaUploadQueue } from '@/features/media/upload-queue'
import { BlogFrontend } from '@/i18n/frontend'
import { Client } from '@/shared/admin/api-client'
import { installBrowserShims, setMediaState } from './environment'
import { serveFetch } from './http'

const owner = 'media-dom-owner'
const csrfToken = 'media-dom-csrf'

type Locale = 'en' | 'zh-CN'
type Mode = 'light' | 'dark'

export type MediaMountOptions = {
  locale?: Locale
  mode?: Mode
  width?: number
}

export type MediaGalleryApiOptions = {
  readonly listing?: (call: ApiCall, read: number) => readonly MediaAsset[] | Promise<readonly MediaAsset[]>
  readonly uploadAssets?: readonly MediaAsset[]
  readonly descriptor?: (
    asset: MediaAsset,
    call: ApiCall,
    read: number,
  ) => ApiReply | Promise<ApiReply>
  readonly transfer?: (
    asset: MediaAsset,
    call: ApiCall,
    attempt: number,
  ) => ApiReply | Promise<ApiReply>
}

export type MountedMediaSurface = {
  readonly container: HTMLElement
  readonly api: ApiService
  readonly unmount: () => void
}

export type MountedGallery = MountedMediaSurface & {
  readonly session: GallerySession
}

export type MountedEditorMedia = MountedMediaSurface & {
  readonly selected: () => MediaAsset | null
  readonly isOpen: () => boolean
}

const mounted: MountedMediaSurface[] = []

/** A schema-built descriptor used as an independent server fixture. */
export function mediaAsset(input: {
  assetId: string
  filename: string
  role: MediaRole
  type: string
  bytes: number
  state?: MediaAsset['state']
  url?: string
  sha256?: string
}): MediaAsset {
  return assetDescriptorSchema.parse({
    assetId: input.assetId,
    state: input.state ?? 'ready',
    url: input.url ?? `/assets/${input.assetId}`,
    filename: input.filename,
    type: input.type,
    bytes: input.bytes,
    sha256: input.sha256 ?? '0'.repeat(64),
    role: input.role,
  })
}

/** Explicit media API replies for the real gallery and editor media components. */
export function mediaGalleryHandlers(options: MediaGalleryApiOptions = {}): Readonly<Record<string, ApiHandler>> {
  const uploadsByName = new Map((options.uploadAssets ?? []).map(asset => [asset.filename, asset]))
  const assetsById = new Map((options.uploadAssets ?? []).map(asset => [asset.assetId, asset]))
  let listingReads = 0
  let descriptorReads = 0
  let transfers = 0

  return {
    'GET /api/admin/session': () => ({
      body: sessionSchema.parse({ ownerSub: owner, csrfToken }),
    }),
    'GET /api/admin/assets': async (call) => {
      listingReads += 1
      const items = await (options.listing?.(call, listingReads) ?? [])
      for (const asset of items) {
        assetsById.set(asset.assetId, asset)
      }
      return { body: assetListSchema.parse({ items, nextCursor: null }) }
    },
    'POST /api/admin/assets': (call) => {
      const request = allocateAssetSchema.parse(call.json)
      const asset = uploadsByName.get(request.filename)
      if (asset === undefined) {
        throw new Error(`No media fixture declared an upload for ${request.filename}`)
      }
      assetsById.set(asset.assetId, asset)
      return {
        body: assetAllocationSchema.parse({
          assetId: asset.assetId,
          state: 'uploading',
          uploadPath: `/api/admin/assets/${asset.assetId}/content`,
        }),
      }
    },
    'GET /api/admin/assets/:id': async (call) => {
      const asset = assetsById.get(assetId(call))
      if (asset === undefined) {
        throw new Error(`No media fixture declared a descriptor for ${call.path}`)
      }
      descriptorReads += 1
      return await (options.descriptor?.(asset, call, descriptorReads) ?? { body: asset })
    },
    'PUT /api/admin/assets/:id/content': async (call) => {
      const asset = assetsById.get(assetId(call))
      if (asset === undefined) {
        throw new Error(`No media fixture declared a transfer for ${call.path}`)
      }
      transfers += 1
      return await (options.transfer?.(asset, call, transfers) ?? { body: asset })
    },
  }
}

/** Mounts the real gallery and session with only its declared fetch table replaced. */
export function mountMediaGallery(
  handlers: Readonly<Record<string, ApiHandler>>,
  options: MediaMountOptions = {},
): MountedGallery {
  const session = new GallerySession(owner, csrfToken)
  const surface = renderMediaSurface(
    <MediaManager session={session} retry={async () => await session.load()} />,
    handlers,
    options,
    () => session.dispose(),
  )
  return { ...surface, session }
}

/**
 * Mounts the real editor media overlay, form, queue and upload client.
 *
 * The workspace supplies only the editor host callbacks the overlay needs; the
 * library, form, queue, upload client and schemas remain the product modules.
 */
export function mountEditorMedia(
  handlers: Readonly<Record<string, ApiHandler>>,
  options: MediaMountOptions = {},
): MountedEditorMedia {
  const client = new Client(csrfToken)
  const queue = new MediaUploadQueue<MediaAsset>(
    async (file, role) => await uploadMedia(client, file, role),
    () => {},
  )
  let selected: MediaAsset | null = null
  let open = true
  // The overlay uses only busy/run and editor.focus in this test; no editor rules are mocked.
  // eslint-disable-next-line ts/no-unsafe-type-assertion -- The host supplies only overlay callbacks.
  const workspace = {
    busy: false,
    run: (task: Promise<unknown>): void => { task.catch(() => {}) },
    model: { editor: { focus: () => {} } },
  } as unknown as Workspace
  const surface = renderMediaSurface(
    <EditorMediaHarness
      queue={queue}
      workspace={workspace}
      select={(asset) => { selected = asset }}
      onOpenChange={(value) => { open = value }}
    />,
    handlers,
    options,
    () => queue.dispose(),
  )
  return {
    ...surface,
    selected: () => selected,
    isOpen: () => open,
  }
}

/** Sends real input/change events with File objects through a real file input. */
export function selectFiles(input: HTMLInputElement, files: readonly File[]): void {
  const transfer = typeof DataTransfer === 'undefined' ? undefined : new DataTransfer()
  if (transfer !== undefined) {
    for (const file of files) {
      transfer.items.add(file)
    }
  }
  const list = transfer?.files ?? fileList(files)
  Object.defineProperty(input, 'files', { configurable: true, value: list })
  act(() => {
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

export function mediaFile(filename: string, type: string, contents: string): File {
  return new File([contents], filename, { type })
}

/** Unmounts surfaces and restores every fetch boundary installed by this support. */
export function resetMediaDom(): void {
  for (const surface of mounted.splice(0).reverse()) {
    surface.unmount()
  }
}

export function renderMediaSurface(
  element: ReactNode,
  handlers: Readonly<Record<string, ApiHandler>>,
  options: MediaMountOptions,
  dispose: () => void,
): MountedMediaSurface {
  installBrowserShims()
  setMediaState({ width: options.width ?? 1440 })
  const api = serveFetch(handlers)
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const policy = createPreferencePolicy({ name: 'blog.dom.media.v1', secure: false })
  const initialPreferences: FrontendPreferences = {
    version: 1,
    mode: options.mode ?? 'light',
    palette: 'neutral',
    locale: options.locale ?? 'en',
  }
  act(() => {
    root.render(
      <BlogFrontend initialPreferences={initialPreferences} policy={policy}>
        {element}
      </BlogFrontend>,
    )
  })
  let unmounted = false
  const surface: MountedMediaSurface = {
    api,
    container,
    unmount: () => {
      if (unmounted) {
        return
      }
      unmounted = true
      act(() => {
        root.unmount()
      })
      container.remove()
      dispose()
      api.dispose()
    },
  }
  mounted.push(surface)
  return surface
}

function EditorMediaHarness({
  queue,
  workspace,
  select,
  onOpenChange,
}: {
  queue: MediaUploadQueue<MediaAsset>
  workspace: Workspace
  select: (asset: MediaAsset) => void
  onOpenChange: (open: boolean) => void
}): ReactNode {
  const [open, setOpen] = useState(true)
  const [role, setRole] = useState<UploadRole>('auto')
  const uploads = useSyncExternalStore(queue.subscribe, queue.snapshot, queue.snapshot)
  const setOpenControlled = (value: boolean): void => {
    onOpenChange(value)
    setOpen(value)
  }
  const model: EditorUploadModel = {
    role,
    setRole,
    queue,
    uploads,
    uploading: uploads.running,
    open,
    setOpen: setOpenControlled,
    loading: false,
    target: undefined,
    editing: false,
    sourceRole: 'auto',
    request: () => {},
    select,
    isOpen: () => open,
  }
  return <EditorMediaOverlay workspace={workspace} model={model} />
}

function fileList(files: readonly File[]): FileList {
  // jsdom 30 has File but no DataTransfer constructor; keep the real input events
  // and File objects while supplying the FileList shape the component reads.
  // eslint-disable-next-line ts/no-unsafe-type-assertion -- FileList's constructor is illegal in jsdom.
  const list = Object.create(window.FileList.prototype) as FileList
  files.forEach((file, index) => {
    Object.defineProperty(list, String(index), { configurable: true, enumerable: true, value: file })
  })
  Object.defineProperty(list, 'length', { configurable: true, value: files.length })
  Object.defineProperty(list, 'item', {
    configurable: true,
    value: (index: number): File | null => files[index] ?? null,
  })
  return list
}

function assetId(call: ApiCall): string {
  return call.path.split('/').at(-1) === 'content'
    ? call.path.split('/').at(-2) ?? ''
    : call.path.split('/').at(-1) ?? ''
}
