import type { ReactNode } from 'react'
import { Inbox, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/ztd-me/client'
import { EditorText } from '@/i18n/labels'

const utility1Class = [
  'notice notice-error [&_button]:mt-2 [&_button]:mr-2 [&_button]:mb-0 [&_button]:ml-0 my-4 mx-0',
  'py-3',
].join(' ')

const utility2Class = [
  'empty-state flex items-start gap-4 p-6 [border:1px_dashed_var(--ztd-border)] rounded-[12px]',
].join(' ')

const utility3Class = [
  '[&_p]:m-0 [&_p]:text-muted-foreground [&_p]:text-help [&_p]:leading-[1.7]',
  '[&_.empty-title]:mt-0',
].join(' ')

const utility4Class = [
  '[&_.empty-title]:text-[length:15px] [&_.empty-title]:font-medium max-[701px]:p-[22px]',
].join(' ')

const layout1Class = [
  utility1Class,
  'px-4 border rounded-[12px] text-help leading-[1.6]',
  'border-[color-mix(in_srgb,_var(--ztd-destructive)_40%,_var(--ztd-border))]',
  'bg-[color-mix(in_srgb,_var(--ztd-destructive)_7%,_var(--ztd-surface))]',
].join(' ')

const layout2Class = [
  utility2Class,
  utility3Class,
  '[&_.empty-title]:mx-0 [&_.empty-title]:mb-[2px] [&_.empty-title]:text-foreground',
  utility4Class,
].join(' ')

export function AdminFeedback({
  loading,
  error,
  retry,
}: {
  loading: boolean
  error: string
  retry: () => Promise<unknown>
}): ReactNode {
  return (
    <>
      {loading && (
        <p className="admin-loading text-muted-foreground text-help" role="status">
          <EditorText value="Loading…" />
        </p>
      )}
      {error !== '' && (
        <div className={layout1Class} role="alert">
          <p>
            <EditorText value={error} />
          </p>
          <Button
            variant="outline"
            type="button"
            disabled={loading}
            onClick={() => {
              retry().catch(() => {})
            }}
          >
            <RefreshCw size={15} aria-hidden="true" />
            <EditorText value="Retry" />
          </Button>
        </div>
      )}
    </>
  )
}

export function AdminEmpty({
  title,
  description,
}: {
  title: string
  description: string
}): ReactNode {
  return (
    <div className={layout2Class}>
      <span
        className={[
          'empty-icon flex items-center justify-center w-11 h-11 rounded-[10px] bg-muted',
          'text-muted-foreground',
        ].join(' ')}
        aria-hidden="true"
      >
        <Inbox size={20} />
      </span>
      <div>
        <p className="empty-title">
          <EditorText value={title} />
        </p>
        <p>
          <EditorText value={description} />
        </p>
      </div>
    </div>
  )
}
