import type { ReactNode } from 'react'
import type { Document } from '@/content/document'
import type { MediaRole } from '@/features/media/media-types'
import { Checkbox, Input, Label, Textarea } from '@/components/ui/ztd-me/client'
import { AssetChoice } from '@/features/editor/media/media-library'
import { EditorText } from '@/i18n/labels'

const fieldsClass = 'grid min-w-0 gap-4 m-0 rounded-xl border border-border p-4'

const empty = {
  alt: '',
  decorative: false,
  transcript: '',
  captionAssetId: null,
  posterAssetId: null,
}
export function MediaFields({
  type,
  value = empty,
  change,
  upload,
}: {
  type: string
  value?: Document['mediaAccessibility'][string]
  change: (value: Document['mediaAccessibility'][string]) => void
  upload: (role: MediaRole) => void
}): ReactNode {
  return (
    <fieldset className={fieldsClass}>
      <legend className="px-1.5 text-help font-semibold"><EditorText value="Media details" /></legend>
      {type !== 'audio' && (
        <Label className="grid gap-2">
          <EditorText value="Alternative text" />
          <Input
            maxLength={2000}
            value={value.alt}
            onChange={event =>
              change({
                ...value,
                alt: event.currentTarget.value,
              })}
          />
        </Label>
      )}
      {type === 'image' && (
        <Label className="checkbox-field flex items-center gap-2.5 font-normal">
          <Checkbox
            checked={value.decorative}
            onCheckedChange={checked =>
              change({
                ...value,
                decorative: checked === true,
              })}
          />
          <EditorText value="Decorative image" />
        </Label>
      )}
      {(type === 'audio' || type === 'video') && (
        <Label className="grid gap-2">
          <EditorText value="Transcript" />
          <Textarea
            maxLength={32768}
            value={value.transcript}
            onChange={event =>
              change({
                ...value,
                transcript: event.currentTarget.value,
              })}
          />
        </Label>
      )}
      {type === 'video' && <AccessoryFields value={value} change={change} upload={upload} />}
    </fieldset>
  )
}

function AccessoryFields({
  value,
  change,
  upload,
}: {
  value: Document['mediaAccessibility'][string]
  change: (value: Document['mediaAccessibility'][string]) => void
  upload: (role: MediaRole) => void
}): ReactNode {
  return (
    <>
      {(['captionAssetId', 'posterAssetId'] as const).map(field => (
        <AssetChoice
          key={field}
          role={field === 'captionAssetId' ? 'caption' : 'poster'}
          value={value[field]}
          change={id => change({ ...value, [field]: id })}
          upload={() => upload(field === 'captionAssetId' ? 'caption' : 'poster')}
        />
      ))}
    </>
  )
}
