'use client'
import type { ReactNode } from 'react'
import type { MediaAsset } from '@/features/media/media-types'
import { ArrowUpRight, Copy } from 'lucide-react'
import { useId } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/ztd-me/client'
import { MediaPreview, MediaSummary } from '@/features/media/media-asset'
import { mediaCardClass, mediaGridClass, mediaMainClass } from '@/features/media/media-card-styles'
import { useEditorLabels } from '@/i18n/use-labels'

export { MediaIcon } from '@/features/media/media-asset'

export function MediaGallery({ items }: { items: MediaAsset[] }): ReactNode {
  const sorted = [
    ...items,
  ].sort((a, b) => Number(isImage(b.role)) - Number(isImage(a.role)))
  return (
    <ul className={[mediaGridClass, 'media-gallery-grid'].join(' ')} aria-label={useEditorLabels()('Gallery')}>
      {sorted.map(asset => <MediaCard key={asset.assetId} asset={asset} />)}
    </ul>
  )
}

function MediaCard({ asset }: { asset: MediaAsset }): ReactNode {
  const text = useEditorLabels()
  const filenameId = useId()
  const content = (
    <>
      <MediaPreview asset={asset} />
      <MediaSummary asset={asset} filenameId={filenameId} heading />
    </>
  )
  return (
    <li className={[mediaCardClass, 'media-card gallery-card flex-wrap'].join(' ')}>
      {asset.state === 'ready'
        ? (
            <>
              <a
                className={[mediaMainClass, 'gallery-open'].join(' ')}
                aria-label={text('Open media')}
                aria-describedby={filenameId}
                title={text('Open media')}
                href={`/api/admin/assets/${asset.assetId}/content`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {content}
                <ArrowUpRight size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
              </a>
              <CopyMedia asset={asset} filenameId={filenameId} />
            </>
          )
        : <div className={mediaMainClass}>{content}</div>}
    </li>
  )
}
function CopyMedia({ asset, filenameId }: { asset: MediaAsset, filenameId: string }): ReactNode {
  const text = useEditorLabels()
  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(new URL(asset.url, window.location.origin).href)
      toast.success(text('Link copied'), { id: 'media-copy' })
    }
    catch {
      toast.error(text('Could not copy the link.'), { id: 'media-copy', duration: 5000 })
    }
  }
  return (
    <Button
      variant="ghost"
      type="button"
      size="icon"
      className="gallery-copy mr-1 shrink-0"
      aria-label={text('Copy asset link')}
      aria-describedby={filenameId}
      title={text('Copy asset link')}
      onClick={() => { copy().catch(() => {}) }}
    >
      <Copy size={16} aria-hidden="true" />
    </Button>
  )
}

function isImage(role: MediaAsset['role']): boolean {
  return role === 'image' || role === 'poster'
}
