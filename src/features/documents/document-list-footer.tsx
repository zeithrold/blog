import type { ReactNode } from 'react'
import type { ListProps } from './document-list-types'
import type { DocumentListCopy } from '@/features/documents/document-list-copy'
import { LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/ztd-me/client'
import { background } from '@/features/editor/core/tasks'
import { layout17Class, layout18Class } from './document-list-layout'
import { utility2Class } from './document-list-utilities'

export function DocumentLoading({ copy, initial }: { copy: DocumentListCopy, initial: boolean }): ReactNode {
  return (
    <div className="document-loading">
      <p
        role="status"
        className="m-0 flex items-center gap-2.5 px-5 py-4 text-help text-muted-foreground"
      >
        <LoaderCircle size={16} className="shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        <span>{copy.loading}</span>
      </p>
      {initial && (
        <div
          className="document-skeleton border-t border-border animate-pulse motion-reduce:animate-none"
          aria-hidden="true"
        >
          {[
            0,
            1,
            2,
            3,
          ].map(value => (
            <div className={layout17Class} key={value}>
              <div className="flex min-w-0 items-center gap-3">
                <span className="size-8 shrink-0 rounded-lg bg-muted" />
                <div className="grid w-full max-w-80 gap-2">
                  <span className="h-3.5 w-3/4 rounded bg-muted" />
                  <span className="h-2.5 w-1/2 rounded bg-muted" />
                </div>
              </div>
              <span className="h-3 w-14 rounded bg-muted max-[701px]:hidden" />
              <span className="h-5 w-20 rounded-full bg-muted max-[701px]:ml-11" />
              <span className="h-3 w-20 rounded bg-muted max-[960px]:hidden" />
              <span className="size-4 rounded bg-muted max-[701px]:hidden" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function DocumentPagination({ controller, state, copy }: ListProps): ReactNode {
  if (state.cursor === null) {
    return state.loaded && state.entries.length > 0 && state.loading === null
      ? <p className="document-list-end text-muted-foreground text-help">{copy.end}</p>
      : null
  }
  return (
    <div className={utility2Class}>
      <Button
        variant="outline"
        type="button"
        className="more-button mt-4"
        disabled={state.loading !== null || state.mutation !== null}
        onClick={() => background(controller.more(), () => {})}
      >
        {state.loading === 'more' && <LoaderCircle size={16} aria-hidden="true" />}
        {state.loading === 'more' ? copy.loadingMore : copy.more}
      </Button>
      {state.loading === 'more' && (
        <span className={layout18Class} role="status">
          {copy.loadingMore}
        </span>
      )}
    </div>
  )
}
