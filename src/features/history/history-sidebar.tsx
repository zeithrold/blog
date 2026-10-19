import type { ReactNode } from 'react'
import type { HistoryModel } from '@/features/history/history-page-model'
import type { BlogTranslator } from '@/i18n/instance'
import { History, LoaderCircle } from 'lucide-react'
import { Badge, Button, ScrollArea } from '@/components/ui/ztd-me/client'
import { RevisionSummary } from '@/features/history/revision-presentation'
import { useSiteLocale } from '@/i18n/site-locale'
import { background } from '@/shared/admin/background'

const utility1Class = [
  'history-sidebar min-w-0 [&_.history-revisions]:max-h-none',
  '[&_.history-revisions]:overflow-visible',
].join(' ')

const utility2Class = [
  '[&_.history-revision_>_button]:border-transparent',
  '[&_.history-revision_>_button]:bg-transparent',
].join(' ')

const utility3Class = [
  'history-sidebar-heading flex items-center justify-between gap-3 [&_h2]:flex',
  '[&_h2]:items-center',
].join(' ')

const utility4Class = ['[&_>_button]:text-left [&_>_button[aria-pressed=true]]:border-accent-foreground'].join(' ')

const utility5Class = [
  '[&_.revision-meta-heading]:gap-2 [&_.revision-meta-detail]:grid',
  '[&_.revision-meta-detail]:gap-px',
].join(' ')

const utility6Class = [
  'history-revisions m-0 p-0 list-none max-[960px]:max-h-[22rem] max-[960px]:overflow-y-auto',
].join(' ')

const layout1Class = [
  utility1Class,
  '[&_.history-revision]:mb-1 [&_.history-revision_>_button]:block',
  '[&_.history-revision_>_button]:py-3 [&_.history-revision_>_button]:px-[10px]',
  utility2Class,
  '[&_.history-revision_>_button]:whitespace-normal',
  '[&_.history-revision_>_button[aria-pressed=true]]:border-transparent',
  '[&_.history-revision_>_button[aria-pressed=true]]:bg-muted',
].join(' ')

const layout2Class = [
  utility3Class,
  '[&_h2]:gap-2 [&_h2]:m-0 [&_h2]:text-[length:14px] [&_h2]:font-medium',
  '[&_>_.ztd-badge]:text-muted-foreground [&_>_.ztd-badge]:text-[length:12px]',
].join(' ')

const layout3Class = [
  'history-revision-scroll max-h-[calc(100dvh_-_280px)]',
  '[&_.ztd-scroll-viewport]:max-h-[calc(100dvh_-_280px)]',
].join(' ')

const layout4Class = [
  'history-revision mb-2 [&_>_button]:grid [&_>_button]:[justify-content:stretch]',
  '[&_>_button]:gap-[6px] [&_>_button]:w-full [&_>_button]:py-3 [&_>_button]:px-4',
  utility4Class,
  '[&_>_button[aria-pressed=true]]:bg-muted [&_.revision-meta]:gap-[7px]',
  utility5Class,
].join(' ')

export function HistorySidebar({ model, text }: { model: HistoryModel, text: BlogTranslator<'editor'> }): ReactNode {
  const locale = useSiteLocale()
  return (
    <aside className={layout1Class} aria-label={text('savedRevisions')}>
      <div className={layout2Class}>
        <h2>
          <History size={17} aria-hidden="true" />
          {text('savedRevisions')}
        </h2>
        <Badge variant="secondary">{model.history.items.length}</Badge>
      </div>
      <ScrollArea className={layout3Class} viewportProps={{ tabIndex: 0 }}>
        <ol className={utility6Class}>
          {model.history.items.map(revision => (
            <li className={layout4Class} key={revision.revisionId}>
              <Button
                variant="ghost"
                type="button"
                disabled={model.busy || model.loading || model.refreshRequired}
                aria-pressed={model.selected.revisionId === revision.revisionId}
                onClick={() => background(model.choose(revision.revisionId, 'selected'), () => {})}
              >
                <RevisionSummary revision={revision} heads={model.current} locale={locale} text={text} />
              </Button>
            </li>
          ))}
        </ol>
      </ScrollArea>
      {model.history.nextBefore !== null && <HistoryMore model={model} text={text} />}
    </aside>
  )
}

export function HistoryMore({ model, text }: { model: HistoryModel, text: BlogTranslator<'editor'> }): ReactNode {
  return (
    <Button
      variant="ghost"
      type="button"
      className="history-more"
      disabled={model.busy || model.loading || model.refreshRequired}
      onClick={() => background(model.more(), () => {})}
    >
      {model.busy && <LoaderCircle size={15} className="revision-loading-icon" aria-hidden="true" />}
      {text('olderRevisions')}
    </Button>
  )
}
