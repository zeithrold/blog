import type { ReactNode } from 'react'
import type { Workspace } from '@/features/editor/workspace/editor-types'
import type { MediaAsset } from '@/features/media/media-types'
import { ArrowUpRight, Plus, RefreshCw } from 'lucide-react'
import { useEffect, useId } from 'react'
import { ChoiceSelect } from '@/components/ui/choice-select'
import { Button } from '@/components/ui/ztd-me/client'
import { cn } from '@/components/ui/ztd-me/ui/cn'
import { useMediaLibrary } from '@/features/editor/media/media-library-model'
import { LibraryStatus } from '@/features/editor/media/media-library-status'
import { MediaPreview, MediaSummary } from '@/features/media/media-asset'
import { mediaCardClass, mediaGridClass, mediaMainClass } from '@/features/media/media-card-styles'
import { EditorText } from '@/i18n/labels'
import { useEditorLabels } from '@/i18n/use-labels'
import { useBlogTranslation } from '@/i18n/use-translation'

const utility10Class = 'min-w-0 m-0 rounded-xl border border-border p-3.5 [&>label]:mt-2.5 [&>button]:mt-2.5'

export function MediaLibrary({ workspace, select, role }: {
  workspace: Workspace
  select: (asset: MediaAsset) => void
  role?: string
}): ReactNode {
  const { t } = useBlogTranslation('editor')
  const model = useMediaLibrary()
  const { load } = model
  useEffect(() => {
    load().catch(() => {})
  }, [load])
  const items = model.items.filter(asset =>
    asset.role !== 'caption' && asset.role !== 'poster' && (role === undefined || asset.role === role))
  return (
    <section className="editor-media-library grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="m-0 text-help text-muted-foreground">
          <EditorText value="Choose media for your document." />
        </p>
        <Button
          variant="ghost"
          size="icon"
          type="button"
          disabled={model.busy}
          aria-label={t('refreshMedia')}
          title={t('refreshMedia')}
          onClick={() => workspace.run(model.load())}
        >
          <RefreshCw size={16} aria-hidden="true" />
        </Button>
      </div>
      <LibraryStatus busy={model.busy} error={model.error} empty={items.length === 0} />
      <ul className={cn(mediaGridClass, 'editor-media-grid', items.length === 1 && 'grid-cols-1')}>
        {items.map(asset => (
          <EditorMediaCard key={asset.assetId} asset={asset} disabled={workspace.busy} select={select} />
        ))}
      </ul>
      {model.cursor !== null && (
        <Button
          variant="outline"
          type="button"
          className="justify-self-center"
          disabled={model.busy}
          onClick={() => workspace.run(model.load(true))}
        >
          {t('moreMedia')}
        </Button>
      )}
    </section>
  )
}

function EditorMediaCard({ asset, disabled, select }: {
  asset: MediaAsset
  disabled: boolean
  select: (asset: MediaAsset) => void
}): ReactNode {
  const text = useEditorLabels()
  const filenameId = useId()
  const ready = asset.state === 'ready'
  return (
    <li className={[mediaCardClass, 'editor-media-card'].join(' ')}>
      <Button
        variant="ghost"
        type="button"
        className={mediaMainClass}
        disabled={disabled || !ready}
        aria-label={text('Use media')}
        title={text('Use media')}
        aria-describedby={filenameId}
        onClick={() => select(asset)}
      >
        <MediaPreview asset={asset} />
        <MediaSummary asset={asset} filenameId={filenameId} />
        {ready && <Plus size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />}
      </Button>
      {ready && (
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="mr-1 shrink-0 text-muted-foreground"
          aria-label={text('Open media')}
          title={text('Open media')}
          aria-describedby={filenameId}
        >
          <a href={`/api/admin/assets/${asset.assetId}/content`} target="_blank" rel="noopener noreferrer">
            <ArrowUpRight size={16} aria-hidden="true" />
          </a>
        </Button>
      )}
    </li>
  )
}
export function AssetChoice({
  role,
  value,
  change,
  upload,
}: {
  role: 'caption' | 'poster'
  value: string | null
  change: (id: string | null) => void
  upload?: () => void
}): ReactNode {
  const { t } = useBlogTranslation('editor')
  const model = useMediaLibrary()
  const label = t(role === 'caption' ? 'videoCaptions' : 'videoPoster')
  const { load } = model
  useEffect(() => {
    load().catch(() => {})
  }, [load])
  return (
    <fieldset className={utility10Class}>
      <legend className="px-1.5 text-help font-semibold">{label}</legend>
      <ChoiceSelect
        label={label}
        value={value ?? ''}
        onValueChange={next => change(next === '' ? null : next)}
        options={[
          { value: '', label: t('none') },
          ...(value !== null && !model.items.some(asset => asset.assetId === value)
            ? [
                { value, label: t('currentSelection') },
              ]
            : []),
          ...model.items
            .filter(asset => asset.state === 'ready' && asset.role === role)
            .map(asset => ({ value: asset.assetId, label: asset.filename })),
        ]}
      />
      {upload !== undefined && (
        <Button type="button" variant="outline" onClick={upload}>
          <EditorText value={role === 'caption' ? 'Upload captions' : 'Upload poster'} />
        </Button>
      )}
      {model.cursor !== null && (
        <Button
          variant="outline"
          type="button"
          disabled={model.busy}
          onClick={() => {
            model.load(true).catch(() => {})
          }}
        >
          {t('moreMedia')}
        </Button>
      )}
      {model.error !== '' && <span role="alert"><EditorText value={model.error} /></span>}
    </fieldset>
  )
}
