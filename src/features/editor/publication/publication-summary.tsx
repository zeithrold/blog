import type { ReactNode } from 'react'
import type { RevealPublicationProblem } from '@/features/editor/publication/publication-issue-list'
import type { Workspace } from '@/features/editor/workspace/editor-types'
import type { BlogTranslator } from '@/i18n/instance'
import { publicationPath } from '@/content/publication-path'
import { PublicationIssueList } from '@/features/editor/publication/publication-issue-list'
import { publicationIssues } from '@/features/editor/publication/publication-model'
import { useBlogTranslation } from '@/i18n/use-translation'

const utility1Class = [
  'publication-facts grid gap-2 m-0 [&_>_div]:grid [&_>_div]:gap-[3px]',
  '[&_dt]:text-muted-foreground',
].join(' ')

const utility2Class = ['publication-summary grid gap-3 p-[14px] border border-border rounded-[12px] bg-card'].join(' ')

const utility3Class = ['editor-field-help m-0 text-muted-foreground text-help leading-[1.65] wrap-anywhere'].join(' ')

const utility4Class = ['editor-field-help m-0 text-muted-foreground text-help leading-[1.65] wrap-anywhere'].join(' ')

const layout1Class = [utility1Class, '[&_dd]:m-0 [&_dd]:wrap-anywhere'].join(' ')

export function PublicationSummary({ workspace, reveal }: {
  workspace: Workspace
  reveal: RevealPublicationProblem
}): ReactNode {
  const text = useBlogTranslation('editor').t
  const { draft, model } = workspace
  const issues = publicationIssues(model.envelope, model.nodeItems)
  const pending = draft.status !== 'saved'
  const target = pending
    ? 'latestDraftAfterSaving'
    : 'savedRevision'
  return (
    <div className={[utility2Class, 'text-help'].join(' ')}>
      <PublicationFacts workspace={workspace} target={text(target)} text={text} />
      {pending && (
        <p className={utility3Class}>
          {text('publishingSavesCurrentDraftBeforeMakingItPublic')}
        </p>
      )}
      {issues.length > 0 && (
        <div className="publication-readiness" data-state="incomplete">
          <p>{text('completeBeforePublishing')}</p>
          <ul className="publication-issues m-0 pl-[18px] text-[var(--ztd-warning)]">
            <PublicationIssueList workspace={workspace} issues={issues} reveal={reveal} />
          </ul>
        </div>
      )}
      <p className={utility4Class}>
        {text('theServerChecksTheRevisionReferencesDiagramsAnd')}
      </p>
    </div>
  )
}

function PublicationFacts({
  workspace,
  target,
  text,
}: {
  workspace: Workspace
  target: string
  text: BlogTranslator<'editor'>
}): ReactNode {
  const { model, draft, props } = workspace
  const path = publicationPath(props.initial.kind, model.envelope.meta.slug)
  const mediaCount = model.nodeItems.filter(node => [
    'image',
    'audio',
    'video',
    'file',
  ].includes(node.type)).length
  return (
    <dl className={layout1Class}>
      <div>
        <dt>{text('publicationTarget')}</dt>
        <dd>
          {target}
          {draft.status === 'saved' && (
            <>
              {' · '}
              <code title={draft.ack.headRevisionId}>{draft.ack.headRevisionId.slice(0, 8)}</code>
            </>
          )}
        </dd>
      </div>
      <div>
        <dt>{text('publicURL')}</dt>
        <dd className="publication-path font-[var(--blog-font-mono)] text-help wrap-anywhere"><code>{path}</code></dd>
      </div>
      <div>
        <dt>{text('media')}</dt>
        <dd>
          {text('value0MediaBlocks', { value0: mediaCount })}
          {model.uploading && (text('uploading3'))}
        </dd>
      </div>
    </dl>
  )
}
