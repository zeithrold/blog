'use client'

import type { ReactNode } from 'react'
import type { Document } from '@/content/document'
import type { Workspace } from '@/features/editor/workspace/editor-types'
import type { MediaAsset } from '@/features/media/media-types'
import { useState } from 'react'
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
} from '@/components/ui/ztd-me/client'
import { MediaLibrary } from '@/features/editor/media/media-library'
import { useEditorLabels } from '@/i18n/use-labels'

type Cover = NonNullable<Document['meta']['cover']>

export type CoverFieldProps = {
  value: Document['meta']['cover']
  busy: boolean
  run: Workspace['run']
  update: (cover: Cover | null) => void
}

const fieldsetClass = 'cover-field grid gap-3 min-w-0 m-0 py-3.5 px-4 border border-border rounded-xl'

const legendClass = 'px-1.5 text-help font-semibold'

const helpClass = 'm-0 text-muted-foreground text-help leading-[1.65]'

const previewClass = 'cover-preview overflow-hidden rounded-lg border border-border bg-muted aspect-[3/2]'

const altHelp = 'Describe the cover for readers who cannot see it. '
  + 'Leave blank when the title already describes the image.'

/** Optional article cover chosen from the existing media library. */
export function CoverField({ value, busy, run, update }: CoverFieldProps): ReactNode {
  const text = useEditorLabels()
  const cover = value ?? null
  return (
    <fieldset className={fieldsetClass}>
      <legend className={legendClass}>{text('Cover image')}</legend>
      {cover === null
        ? <p className={helpClass}>{text('Optional. A cover appears on the home page for this article.')}</p>
        : (
            <div className={previewClass}>
              <img
                className="block size-full object-cover"
                src={`/api/admin/assets/${cover.assetId}/content`}
                alt=""
              />
            </div>
          )}
      <div className="flex flex-wrap gap-2">
        <CoverPicker
          busy={busy}
          run={run}
          hasCover={cover !== null}
          select={asset => update({
            assetId: asset.assetId,
            alt: cover?.alt ?? '',
          })}
        />
        {cover !== null && (
          <Button type="button" variant="ghost" disabled={busy} onClick={() => update(null)}>
            {text('Remove cover')}
          </Button>
        )}
      </div>
      {cover !== null && (
        <>
          <Label className="grid gap-2">
            {text('Cover description')}
            <Input
              value={cover.alt}
              maxLength={2000}
              disabled={busy}
              onChange={event => update({
                ...cover,
                alt: event.currentTarget.value,
              })}
            />
          </Label>
          <p className={helpClass}>{text(altHelp)}</p>
        </>
      )}
    </fieldset>
  )
}

function CoverPicker({ busy, run, hasCover, select }: {
  busy: boolean
  run: Workspace['run']
  hasCover: boolean
  select: (asset: MediaAsset) => void
}): ReactNode {
  const text = useEditorLabels()
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" disabled={busy}>
          {text(hasCover ? 'Change cover' : 'Choose cover')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{text('Choose a cover image')}</DialogTitle>
          <DialogDescription>
            {text('Only images from the media library can be used as a cover.')}
          </DialogDescription>
        </DialogHeader>
        <MediaLibrary
          workspace={{ busy, run }}
          role="image"
          select={(asset) => {
            select(asset)
            setOpen(false)
          }}
        />
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost">{text('Close')}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
