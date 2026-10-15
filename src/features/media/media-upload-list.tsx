'use client'
import type { ReactNode } from 'react'
import type { MediaUploadModel, UploadItem } from '@/features/media/upload-queue'
import { Check, LoaderCircle, RotateCw, X } from 'lucide-react'
import { useId } from 'react'
import { Button } from '@/components/ui/ztd-me/client'
import { MediaSize } from '@/features/media/media-asset'
import { EditorText } from '@/i18n/labels'
import { useEditorLabels } from '@/i18n/use-labels'

const utility1Class = ['media-upload-progress grid gap-2 text-muted-foreground text-help [&_progress]:w-full'].join(' ')

const utility2Class = [
  'media-upload-item flex flex-wrap items-center gap-y-[10px] gap-x-4 py-3 border-b border-border',
].join(' ')

const utility3Class = ['media-upload-state text-muted-foreground text-help flex flex-wrap items-center gap-2'].join(' ')

const layout1Class = [utility1Class, '[&_progress]:h-2 [&_progress]:[accent-color:var(--ztd-accent)]'].join(' ')

const layout2Class = [
  utility2Class,
  '[&[data-state=failed]_.media-upload-state]:text-destructive',
  '[&[data-state=complete]_.media-upload-state]:text-[var(--ztd-success)]',
].join(' ')

const layout3Class = [utility3Class, 'max-[701px]:basis-full'].join(' ')

type Model = MediaUploadModel
const stateLabel = { queued: 'Waiting', uploading: 'Uploading…', complete: 'Upload complete.', failed: 'Upload failed' }

export function MediaUploadList({ model }: { model: Model }): ReactNode {
  const text = useEditorLabels()
  const { items, running } = model.uploads
  const processed = items.filter(item => item.state === 'complete' || item.state === 'failed').length
  return items.length === 0
    ? null
    : (
        <section className="media-upload-queue grid gap-4 min-w-0" aria-label={text('Upload queue')}>
          <div className={layout1Class} role="status" aria-atomic="true">
            <span>
              <EditorText value="Files processed" />
              {` · ${processed} / ${items.length}`}
            </span>
            <progress max={items.length} value={processed} aria-label={text('Files processed')} />
            {running && <span><EditorText value="Keep this window open while files upload." /></span>}
          </div>
          <ul className="media-upload-items m-0 p-0 list-none">
            {items.map(item => <UploadRow key={item.id} item={item} model={model} />)}
          </ul>
          <div className="media-upload-actions flex flex-wrap items-center gap-2">
            <Button
              type="button"
              disabled={running || !items.some(item => item.state === 'queued')}
              onClick={() => { model.queue.start().catch(() => {}) }}
            >
              <EditorText value={running ? 'Uploading…' : 'Upload files'} />
            </Button>
            {items.some(item => item.state === 'complete') && (
              <Button type="button" variant="ghost" disabled={running} onClick={() => model.queue.clearCompleted()}>
                <EditorText value="Clear completed" />
              </Button>
            )}
          </div>
        </section>
      )
}

function UploadRow({ item, model }: { item: UploadItem, model: Model }): ReactNode {
  const text = useEditorLabels()
  const filenameId = useId()
  return (
    <li className={layout2Class} data-state={item.state}>
      <div className={[
        'media-upload-file grid flex-1 gap-1 min-w-0 wrap-anywhere [&_strong]:text-help',
        '[&_strong]:font-medium',
      ].join(' ')}
      >
        <strong id={filenameId}>{item.file.name}</strong>
        <span className="media-upload-file-meta text-muted-foreground text-help">
          <EditorText value={item.role} />
          {' · '}
          <MediaSize bytes={item.file.size} />
        </span>
      </div>
      <span className={layout3Class}>
        {item.state === 'uploading' && <LoaderCircle size={16} aria-hidden="true" />}
        {item.state === 'complete' && <Check size={16} aria-hidden="true" />}
        <EditorText value={stateLabel[item.state]} />
      </span>
      <div className="media-upload-row-actions flex flex-wrap items-center gap-2 max-[701px]:ml-auto">
        {item.state === 'failed' && (
          <Button
            type="button"
            variant="outline"
            disabled={model.uploading}
            aria-describedby={filenameId}
            onClick={() => { model.queue.start(item.id).catch(() => {}) }}
          >
            <RotateCw size={14} aria-hidden="true" />
            <EditorText value="Retry" />
          </Button>
        )}
        {item.state !== 'complete' && (
          <Button
            type="button"
            variant="ghost"
            disabled={model.uploading}
            aria-label={text('Remove file')}
            aria-describedby={filenameId}
            onClick={() => model.queue.remove(item.id)}
          >
            <X size={16} aria-hidden="true" />
          </Button>
        )}
      </div>
      {item.error !== '' && (
        <p className="media-upload-error basis-full m-0 text-destructive text-help leading-[1.6]" role="alert">
          <EditorText value={item.error} />
        </p>
      )}
    </li>
  )
}
