import type { ReactNode } from 'react'
import type { RevisionHistory } from '@/features/history/revision-history-model'
import type { BlogTranslator } from '@/i18n/instance'
import { useSyncExternalStore } from 'react'
import { Badge } from '@/components/ui/ztd-me/client'
import { revisionReason, revisionTime } from '@/features/history/revision-labels'

const utility1Class = [
  'revision-meta grid gap-[10px] [&_time]:text-muted-foreground [&_time]:text-help min-w-0',
].join(' ')

const utility2Class = ['[&_strong]:text-[length:14px] [&_strong]:font-medium [&_strong]:whitespace-nowrap'].join(' ')

const utility3Class = [
  'revision-meta-detail flex flex-wrap items-center gap-y-[6px] gap-x-[10px]',
  'text-muted-foreground',
].join(' ')

const layout1Class = [utility1Class, 'whitespace-normal [&_.revision-badges]:gap-[6px]'].join(' ')

const layout2Class = [
  'revision-meta-heading flex flex-wrap items-center gap-y-[6px] gap-x-[10px]',
  utility2Class,
].join(' ')

const layout3Class = [utility3Class, 'text-[length:12px] leading-[1.6] [&_time]:text-[length:inherit]'].join(' ')

type Revision = RevisionHistory['items'][number]
type RevisionHeads = { headRevisionId: string, liveRevisionId: string | null }

export function RevisionSummary({ revision, heads, locale, text }: {
  revision: Revision
  heads: RevisionHeads
  locale: string
  text: BlogTranslator<'editor'>
}): ReactNode {
  const localized = useSyncExternalStore(subscribeToTime, clientTime, serverTime)
  const iso = new Date(revision.createdAt).toISOString()
  return (
    <span className={layout1Class}>
      <span className={layout2Class}>
        <strong>{`${text('revision')} ${revision.sequence}`}</strong>
        <RevisionState id={revision.revisionId} heads={heads} text={text} />
      </span>
      <span className={layout3Class}>
        <span>{revisionReason(revision.reason, text)}</span>
        <time dateTime={iso}>
          {localized ? revisionTime(revision.createdAt, locale) : `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`}
        </time>
      </span>
    </span>
  )
}

// Server and browser can use different time zones and Intl punctuation. Hydrate
// the same UTC text first, then display the reader's local time in their locale.
function subscribeToTime(): () => void {
  return () => { /* Time formatting has no external change subscription. */ }
}
function clientTime(): boolean {
  return true
}
function serverTime(): boolean {
  return false
}

export function RevisionState({ id, heads, text }: {
  id: string
  heads: RevisionHeads
  text: BlogTranslator<'editor'>
}): ReactNode {
  return (
    <span className="revision-badges flex flex-wrap gap-2">
      {id === heads.headRevisionId && (
        <Badge variant="secondary">
          <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
          {text('currentDraft')}
        </Badge>
      )}
      {id === heads.liveRevisionId && (
        <Badge variant="secondary">
          <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
          {text('live')}
        </Badge>
      )}
    </span>
  )
}
