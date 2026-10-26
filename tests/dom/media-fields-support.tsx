/* eslint-disable react-refresh/only-export-components -- Test support, not a Fast Refresh boundary. */
import type { ReactNode } from 'react'
import type { ApiHandler } from './http'
import type { MediaMountOptions, MountedMediaSurface } from './media-support'
import type { Document } from '@/content/document'
import type { MediaRole } from '@/features/media/media-types'
import { useState } from 'react'
import { MediaFields } from '@/features/editor/workspace/accessibility'
import { renderMediaSurface } from './media-support'

type MediaFieldsValue = Document['mediaAccessibility'][string]

export type MountedMediaFields = MountedMediaSurface & {
  readonly value: () => MediaFieldsValue
  readonly uploads: () => readonly MediaRole[]
}

/** Mounts the real details fields without constructing an editor or block context. */
export function mountMediaFields(
  type: string,
  initial: MediaFieldsValue,
  handlers: Readonly<Record<string, ApiHandler>>,
  options: MediaMountOptions = {},
): MountedMediaFields {
  let value = initial
  const uploads: MediaRole[] = []
  const surface = renderMediaSurface(
    <MediaFieldsHarness
      type={type}
      initial={initial}
      change={(next) => { value = next }}
      upload={role => uploads.push(role)}
    />,
    handlers,
    options,
    () => {},
  )
  return {
    ...surface,
    value: () => value,
    uploads: () => uploads,
  }
}

function MediaFieldsHarness({
  type,
  initial,
  change,
  upload,
}: {
  type: string
  initial: MediaFieldsValue
  change: (value: MediaFieldsValue) => void
  upload: (role: MediaRole) => void
}): ReactNode {
  const [value, setValue] = useState(initial)
  return (
    <MediaFields
      type={type}
      value={value}
      change={(next) => {
        change(next)
        setValue(next)
      }}
      upload={upload}
    />
  )
}
