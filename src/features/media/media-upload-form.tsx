'use client'
import type { DragEvent, ReactNode } from 'react'
import type { MediaUploadModel } from '@/features/media/upload-queue'
import { CloudUpload } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { ChoiceSelect } from '@/components/ui/choice-select'
import { assetRoleSchema } from '@/contracts/media'
import { mediaFormats, mediaLimits } from '@/features/media/media-types'
import { MediaUploadList } from '@/features/media/media-upload-list'
import { EditorText } from '@/i18n/labels'
import { useEditorLabels } from '@/i18n/use-labels'
import { FilePicker } from '@/shared/admin/file-picker'

const utility1Class = [
  'media-dropzone grid [justify-items:center] gap-3 py-7 px-5',
  '[border:1px_dashed_var(--ztd-border)]',
].join(' ')

const utility2Class = [
  'rounded-[12px] bg-[color-mix(in_srgb,_var(--ztd-muted)_35%,_var(--ztd-surface))] text-center',
].join(' ')

const utility3Class = ['[&[data-dragging=true]]:border-accent-foreground [&[data-dragging=true]]:bg-muted'].join(' ')

const utility4Class = ['[&_>_svg]:text-muted-foreground [&_p]:m-0 [&_p]:text-[length:16px] [&_p]:font-medium'].join(' ')

const layout1Class = [
  utility1Class,
  utility2Class,
  utility3Class,
  utility4Class,
].join(' ')

type Model = MediaUploadModel
const CLEANUP_NOTE = 'Unused uploads can be cleaned up after 24 hours. '
  + 'Draft and historical references protect media.'
export function MediaUploadForm({ model }: { model: Model }): ReactNode {
  const text = useEditorLabels()
  const helpId = useId()
  const options = [
    { value: 'auto', label: text('Automatic') },
    ...assetRoleSchema.options.map(value => ({ value, label: text(value) })),
  ]
  return (
    <div className="media-upload-form grid gap-4">
      <ChoiceSelect
        value={model.role}
        options={options}
        label={text('Media role')}
        disabled={model.uploading}
        onValueChange={value => model.setRole(value === 'auto' ? 'auto' : assetRoleSchema.parse(value))}
      />
      <MediaDropzone model={model} helpId={helpId} />
      <p id={helpId} className="media-upload-help m-0 text-muted-foreground text-help leading-[1.6]">
        {mediaLimits[model.role]}
      </p>
      <MediaUploadList model={model} />
      <p className="media-upload-help m-0 text-muted-foreground text-help leading-[1.6]">
        <EditorText value={CLEANUP_NOTE} />
      </p>
    </div>
  )
}

function MediaDropzone({ model, helpId }: { model: Model, helpId: string }): ReactNode {
  const text = useEditorLabels()
  const [dragging, setDragging] = useState(false)
  const depthRef = useRef(0)
  const drag = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    event.dataTransfer.dropEffect = model.uploading ? 'none' : 'copy'
  }
  return (
    <div
      className={layout1Class}
      data-dragging={dragging}
      role="group"
      aria-label={text('Drop files here')}
      onDragOver={drag}
      onDragEnter={(event) => {
        drag(event)
        depthRef.current++
        if (!model.uploading) {
          setDragging(true)
        }
      }}
      onDragLeave={(event) => {
        event.preventDefault()
        depthRef.current--
        if (depthRef.current <= 0) {
          setDragging(false)
        }
      }}
      onDrop={(event) => {
        event.preventDefault()
        depthRef.current = 0
        setDragging(false)
        model.queue.enqueue(Array.from(event.dataTransfer.files), model.role)
      }}
    >
      <CloudUpload size={32} aria-hidden="true" />
      <p><EditorText value="Drop files here" /></p>
      <FilePicker
        label={text('Media file')}
        hideLabel
        className="w-full max-w-60"
        multiple
        accept={mediaFormats[model.role]}
        disabled={model.uploading}
        aria-describedby={helpId}
        onChange={(event) => {
          model.queue.enqueue(Array.from(event.currentTarget.files ?? []), model.role)
          event.currentTarget.value = ''
        }}
      />
    </div>
  )
}
