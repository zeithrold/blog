import type { ReactNode } from 'react'
import { Image, LoaderCircle } from 'lucide-react'
import { EditorText } from '@/i18n/labels'

export function LibraryStatus({ busy, error, empty }: {
  busy: boolean
  error: string
  empty: boolean
}): ReactNode {
  if (error !== '') {
    return <p role="alert"><EditorText value={error} /></p>
  }
  if (!empty) {
    return null
  }
  if (busy) {
    return (
      <div className="flex min-h-36 items-center justify-center gap-2 text-help text-muted-foreground" role="status">
        <LoaderCircle className="animate-spin motion-reduce:animate-none" size={16} aria-hidden="true" />
        <EditorText value="Loading…" />
      </div>
    )
  }
  return (
    <div className="grid justify-items-center gap-2 rounded-xl border border-dashed border-border py-9 px-4">
      <span className="mb-1 flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Image size={20} aria-hidden="true" />
      </span>
      <p className="m-0 text-control font-medium"><EditorText value="No media yet" /></p>
      <p className="m-0 text-help text-muted-foreground">
        <EditorText value="Upload a file to build your media library." />
      </p>
    </div>
  )
}
