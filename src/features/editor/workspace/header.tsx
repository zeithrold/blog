import type { ReactNode } from 'react'
import type { ScheduleModel } from '@/features/editor/publication/schedule-controller'
import type { Workspace } from '@/features/editor/workspace/editor-types'
import { ArrowLeft, ArrowUpRight, Send } from 'lucide-react'
import { Badge, Button } from '@/components/ui/ztd-me/client'
import { ScheduledStatus } from '@/features/editor/publication/schedule-status'
import { DocumentActions } from '@/features/editor/workspace/document-actions'
import { useStickyHeight } from '@/hooks/use-sticky-height'
import { useEditorLabels } from '@/i18n/use-labels'
import { GuardedLink } from '@/shared/admin/navigation-guard'
import { SaveStatus } from '@/shared/admin/save-status'

const utility1Class = [
  'workspace-header sticky top-[var(--admin-appbar-height)] z-[20] flex flex-wrap items-center',
].join(' ')

const utility2Class = [
  'bg-[color-mix(in_srgb,_var(--ztd-background)_92%,_transparent)] [backdrop-filter:blur(8px)]',
].join(' ')

const utility3Class = ['max-[701px]:grid-cols-[minmax(0,_1fr)_auto] max-[701px]:gap-y-0 max-[701px]:gap-x-2'].join(' ')

const utility4Class = [
  'max-[701px]:[&_.back-link]:[grid-row:1] max-[701px]:[&_.back-link]:[justify-self:start]',
].join(' ')

const utility5Class = ['max-[701px]:[&_.back-link]:min-h-11 max-[701px]:[&_.back-link]:text-control'].join(' ')

const utility6Class = [
  'back-link inline-flex items-center gap-2 min-h-11 text-muted-foreground text-help font-medium',
].join(' ')

const utility7Class = [
  'workspace-status flex flex-wrap items-center gap-2 min-w-0 max-w-full pl-4 border-l',
  'border-border',
].join(' ')

const utility8Class = [
  '[&_.status-badge]:whitespace-normal max-[701px]:[grid-column:1_/_-1] max-[701px]:[grid-row:2]',
].join(' ')

const utility9Class = [
  'workspace-actions flex flex-wrap items-center gap-2 ml-auto max-[701px]:[grid-column:2]',
].join(' ')

const utility10Class = [
  'max-[701px]:[grid-row:1] max-[701px]:flex-nowrap max-[701px]:gap-[2px] max-[701px]:w-auto',
].join(' ')

const utility11Class = [
  'max-[701px]:[&_>_.editor-publish-action]:min-h-11',
  'max-[701px]:[&_>_.editor-publish-action]:py-2',
].join(' ')

const layout1Class = [
  utility1Class,
  'gap-y-1 gap-x-4 min-h-[61px] py-2 px-6 border-b border-border',
  utility2Class,
  '[&_.back-link]:mr-0 max-[1023.99px]:px-6 max-[701px]:grid',
  utility3Class,
  'max-[701px]:py-[4px_12px] max-[701px]:[&_.back-link]:[grid-column:1]',
  utility4Class,
  utility5Class,
  'max-[701px]:[&_.back-link]:whitespace-nowrap max-[639.99px]:px-4',
].join(' ')

const layout2Class = [
  utility6Class,
  'no-underline hover:text-foreground [&_svg]:[transition:transform_0.2s]',
  '[&:hover_svg]:transform-[translateX(-2px)]',
].join(' ')

const layout3Class = [
  utility7Class,
  utility8Class,
  'max-[701px]:gap-y-1 max-[701px]:gap-x-2 max-[701px]:pl-0 max-[701px]:border-l-0',
].join(' ')

const layout4Class = [
  utility9Class,
  utility10Class,
  'max-[701px]:ml-0 max-[701px]:[&_>_.editor-live-link]:hidden',
  utility11Class,
  'max-[701px]:[&_>_.editor-publish-action]:px-[10px]',
  'max-[701px]:[&_>_.editor-publish-action]:border-transparent',
  'max-[701px]:[&_>_.editor-publish-action]:bg-transparent',
].join(' ')

type HeaderProps = {
  workspace: Workspace
  publish: (unpublish?: boolean) => Promise<void>
  remove: () => Promise<void>
  livePath: string | null
  schedules: ScheduleModel['items']
}

export function EditorHeader(props: HeaderProps): ReactNode {
  const headerRef = useStickyHeight('--admin-header-height')
  const text = useEditorLabels()
  const { workspace } = props
  const { draft } = workspace
  const state = publicationState(draft)
  return (
    <header ref={headerRef} className={layout1Class}>
      <GuardedLink className={layout2Class} href="/admin" aria-label={text('All documents')}>
        <ArrowLeft size={18} aria-hidden="true" />
        <span className="editor-back-full max-[701px]:hidden" aria-hidden="true">{text('All documents')}</span>
        <span className="editor-back-compact hidden max-[701px]:[display:inline]" aria-hidden="true">
          {text('Back')}
        </span>
      </GuardedLink>
      <div className={layout3Class}>
        <SaveStatus status={draft.status} className="save-status" />
        <Badge variant={state === 'changed' ? 'warning' : 'secondary'} data-state={state}>
          <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
          {text({ draft: 'Draft', live: 'Published', changed: 'Published · unpublished changes' }[state])}
        </Badge>
        <ScheduledStatus items={props.schedules} />
        {workspace.model.uploading && <span role="status">{text('Uploading media…')}</span>}
      </div>
      <HeaderActions {...props} />
    </header>
  )
}

function publicationState(draft: Workspace['draft']): 'draft' | 'live' | 'changed' {
  const { ack } = draft
  if (ack.liveRevisionId === null) {
    return 'draft'
  }
  return ack.liveRevisionId === ack.headRevisionId && draft.status === 'saved' ? 'live' : 'changed'
}

function HeaderActions({ workspace, publish, remove, livePath }: HeaderProps): ReactNode {
  const text = useEditorLabels()
  const { busy, draft, run } = workspace
  return (
    <div className={layout4Class}>
      {livePath !== null && (
        <Button variant="ghost" asChild className="editor-live-link flex flex-wrap items-center gap-2 min-h-11">
          <a href={livePath} target="_blank" rel="noopener noreferrer">
            {text('View live document')}
            <ArrowUpRight size={16} aria-hidden="true" />
          </a>
        </Button>
      )}
      <Button
        type="button"
        variant="outline"
        className="editor-publish-action max-[701px]:[&_>_svg]:hidden"
        aria-label={text(draft.ack.liveRevisionId === null ? 'Publish' : 'Update publication')}
        disabled={busy || workspace.model.uploading || draft.status === 'conflict'}
        onClick={() => run(publish())}
      >
        <Send size={16} aria-hidden="true" />
        <span className="editor-publish-full max-[701px]:hidden" aria-hidden="true">
          {text(draft.ack.liveRevisionId === null ? 'Publish' : 'Update publication')}
        </span>
        <span className="editor-publish-compact hidden max-[701px]:[display:inline]" aria-hidden="true">
          {text(draft.ack.liveRevisionId === null ? 'Publish' : 'Update')}
        </span>
      </Button>
      <DocumentActions workspace={workspace} publish={publish} remove={remove} livePath={livePath} />
    </div>
  )
}
