import type { ReactNode } from 'react'
import { LoaderCircle } from 'lucide-react'
import { cn } from '@/components/ui/ztd-me/ui/cn'
import { useBlogTranslation } from '@/i18n/use-translation'

const template1Class = [
  'editor-loading-skeleton block w-full h-3.5 rounded-md bg-muted animate-pulse',
  'motion-reduce:animate-none',
].join(' ')

const utility1Class = [
  'editor-loading-chrome flex items-center justify-between gap-6 min-h-[61px] py-4 px-6 border-b',
].join(' ')

const utility2Class = [
  'editor-loading-document w-full max-w-205 min-w-0 [justify-self:center] pt-10 px-12 pb-20',
].join(' ')

const utility3Class = [
  'editor-loading-settings grid [align-content:start] gap-5 py-7 px-6 border-l border-border',
].join(' ')

const utility4Class = [
  'editor-loading-status flex items-center gap-[10px] mb-7 text-muted-foreground text-help',
].join(' ')

const layout1Class = [utility1Class, 'border-border max-[639.99px]:px-4'].join(' ')

const layout2Class = [utility2Class, 'max-[639.99px]:pt-8 max-[639.99px]:px-6 max-[639.99px]:pb-16'].join(' ')

const layout3Class = [utility3Class, 'bg-[var(--admin-sidebar-background)] max-[1100px]:hidden'].join(' ')

export function LoadingEditor(): ReactNode {
  const { t } = useBlogTranslation('editor')
  return (
    <section className="editor-loading min-h-[min(720px,_80dvh)] bg-background">
      <div className={layout1Class} aria-hidden="true">
        <Skeleton className="editor-loading-back w-30" />
        <Skeleton className="editor-loading-actions w-50 max-[639.99px]:w-30" />
      </div>
      <div className={[
        'editor-loading-layout grid grid-cols-[minmax(0,_1fr)_360px]',
        'max-[1100px]:grid-cols-[minmax(0,_1fr)]',
      ].join(' ')}
      >
        <div className={layout2Class}>
          <div className={utility4Class} role="status" aria-live="polite">
            <LoaderCircle
              className="editor-loading-spinner shrink-0 text-foreground animate-spin motion-reduce:animate-none"
              size={20}
              aria-hidden="true"
            />
            <span>{t('loadingEditor')}</span>
          </div>
          <div className="editor-loading-copy grid [align-content:start] gap-5" aria-hidden="true">
            <Skeleton className="editor-loading-title w-[78%] h-11 mb-3" />
            <Skeleton className="editor-loading-toolbar w-[68%] h-8 mb-4" />
            <Skeleton />
            <Skeleton />
            <Skeleton className="editor-loading-short w-[74%]" />
            <Skeleton />
            <Skeleton className="editor-loading-short w-[74%]" />
          </div>
        </div>
        <div className={layout3Class} aria-hidden="true">
          <Skeleton className="editor-loading-sidebar-title w-[60%] mb-3" />
          <Skeleton className="editor-loading-control h-13" />
          <Skeleton className="editor-loading-control h-13" />
          <Skeleton className="editor-loading-control h-13" />
        </div>
      </div>
    </section>
  )
}

function Skeleton({ className = '' }: { className?: string }): ReactNode {
  return <span className={cn(template1Class, className)} />
}
