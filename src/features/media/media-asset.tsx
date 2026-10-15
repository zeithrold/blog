import type { ReactNode } from 'react'
import type { MediaAsset, MediaRole } from '@/features/media/media-types'
import { File, Film, Image, Music2 } from 'lucide-react'
import { useFrontendPreferences } from '@/components/ui/ztd-me/client'
import { EditorText } from '@/i18n/labels'

export function MediaPreview({ asset }: { asset: MediaAsset }): ReactNode {
  return (
    <span className={[
      'gallery-thumbnail editor-media-thumbnail flex size-20 shrink-0 items-center justify-center',
      'overflow-hidden rounded-lg border border-border/60 bg-muted/60 text-muted-foreground',
      'max-[380px]:size-18',
    ].join(' ')}
    >
      {asset.state === 'ready' && isImage(asset.role)
        ? (
            <img
              className="size-full object-contain"
              src={`/api/admin/assets/${asset.assetId}/content`}
              alt=""
              loading="lazy"
              width={160}
              height={160}
            />
          )
        : <MediaIcon role={asset.role} />}
    </span>
  )
}

export function MediaSummary({ asset, filenameId, heading = false }: {
  asset: MediaAsset
  filenameId: string
  heading?: boolean
}): ReactNode {
  const Filename = heading ? 'h2' : 'span'
  const Summary = heading ? 'div' : 'span'
  return (
    <Summary className="media-asset-summary grid min-w-0 flex-1 gap-1.5">
      <Filename id={filenameId} title={asset.filename} className="m-0 truncate text-control font-medium leading-snug">
        {asset.filename}
      </Filename>
      <span className="gallery-meta editor-media-meta text-help text-muted-foreground leading-normal">
        <EditorText value={asset.role} />
        {' · '}
        <MediaSize bytes={asset.bytes} />
      </span>
      {asset.state !== 'ready' && (
        <span className="text-help text-muted-foreground"><EditorText value={asset.state} /></span>
      )}
    </Summary>
  )
}

export function MediaSize({ bytes }: { bytes: number }): ReactNode {
  const locale = useFrontendPreferences().preferences.locale
  const { divisor, unit } = mediaScale(bytes)
  const size = new Intl.NumberFormat(locale, { maximumFractionDigits: divisor === 1 ? 0 : 1 }).format(bytes / divisor)
  return (
    <>
      {size}
      {' '}
      {unit}
    </>
  )
}

export function MediaIcon({ role }: { role: MediaRole }): ReactNode {
  if (role === 'audio') {
    return <Music2 size={28} aria-hidden="true" />
  }
  if (role === 'video') {
    return <Film size={28} aria-hidden="true" />
  }
  return isImage(role) ? <Image size={28} aria-hidden="true" /> : <File size={28} aria-hidden="true" />
}

function isImage(role: MediaRole): boolean {
  return role === 'image' || role === 'poster'
}

function mediaScale(bytes: number): { divisor: number, unit: string } {
  if (bytes < 1024) {
    return { divisor: 1, unit: 'B' }
  }
  if (bytes < 1048576) {
    return { divisor: 1024, unit: 'KiB' }
  }
  return { divisor: 1048576, unit: 'MiB' }
}
