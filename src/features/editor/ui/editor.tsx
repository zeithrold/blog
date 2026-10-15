'use client'
import type { ReactNode } from 'react'
import type { EditorProps, SessionProps, Workspace } from '@/features/editor/core/editor-types'
import type { Envelope } from '@/features/editor/core/model'
import { CircleAlert, FileCheck2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Input, Label, useFrontendPreferences } from '@/components/ui/ztd-me/client'
import { cn } from '@/components/ui/ztd-me/ui/cn'
import { openDocumentSchema } from '@/content/contracts'
import { useDocumentModel } from '@/features/editor/core/model'
import { useDraft } from '@/features/editor/core/persistence'
import { RichMetadataContext } from '@/features/editor/core/rich-context'
import { useRichMetadata } from '@/features/editor/core/rich-metadata'
import { useActions } from '@/features/editor/services/actions'
import { get } from '@/features/editor/services/api-client'
import { useScheduleList } from '@/features/editor/services/schedule-controller'
import { EditorBody } from '@/features/editor/ui/body'
import { EditorHeader } from '@/features/editor/ui/header'
import { DraftPreviewProvider } from '@/features/editor/ui/live-preview'
import { DraftNotices } from '@/features/editor/ui/notices'
import { EditorSettings } from '@/features/editor/ui/settings'
import { useEditorLabels } from '@/i18n/use-labels'
import { useBlogTranslation } from '@/i18n/use-translation'

const utility1Class = [
  'workspace-grid grid grid-cols-[minmax(0,_1fr)_360px] [align-items:start] max-[1100px]:flex',
].join(' ')

const utility2Class = [
  '[&_>_.blog-editor]:mx-[-2rem] max-[1100px]:max-w-220 max-[1100px]:[align-self:center]',
].join(' ')

const utility3Class = [
  'local-status flex items-start gap-[6px] mt-5 mx-0 mb-0 [&_>_svg]:shrink-0 [&_>_svg]:mt-[2px]',
].join(' ')

const utility4Class = [
  '[&[data-state=unavailable]]:text-[var(--ztd-warning)] text-muted-foreground text-help',
].join(' ')

const utility5Class = [
  'title-field gap-0 mb-1 [&_input]:min-h-16 [&_input]:py-1 [&_input]:px-0 [&_input]:border-0',
].join(' ')

const utility6Class = [
  '[&_input]:tracking-[-0.025em] [&_input]:leading-[1.2] [&_input:focus-visible]:[outline:none]',
].join(' ')

const utility7Class = [
  '[&_input:focus-visible]:shadow-[inset_0_-2px_0_var(--ztd-focus)] [&_.field-label]:absolute',
].join(' ')

const utility8Class = ['field-label text-muted-foreground text-help font-medium tracking-[0.14em] uppercase'].join(' ')

const layout1Class = [utility1Class, 'max-[1100px]:flex-col max-[1100px]:grid-cols-[minmax(0,_1fr)]'].join(' ')

const layout2Class = [
  'document-editor w-full min-w-0 max-w-205 [justify-self:center] pt-14 px-12 pb-30',
  utility2Class,
  'max-[1100px]:pb-25 max-[701px]:pt-7 max-[701px]:px-4 max-[701px]:pb-16',
  'max-[701px]:[&_>_.blog-editor]:mx-[-1rem]',
].join(' ')

const layout3Class = [utility3Class, utility4Class].join(' ')

export default function Editor(props: EditorProps): ReactNode {
  const [session, setSession] = useState({
    initial: props.initial,
    generation: 0,
    recovered: false,
  })
  return (
    <EditorSession
      key={`${session.initial.documentId}:${session.generation}`}
      {...props}
      {...session}
      reopen={(initial, recovered = false) =>
        setSession(old => ({
          initial,
          generation: old.generation + 1,
          recovered,
        }))}
    />
  )
}
function EditorSession(props: SessionProps): ReactNode {
  const { preferences } = useFrontendPreferences()
  const [resolving, setResolving] = useState(false)
  const model = useDocumentModel(props.initial, preferences.locale, props.csrfToken, props.owner)
  const draft = useDraft({
    initial: props.initial,
    owner: props.owner,
    csrfToken: props.csrfToken,
    model,
    recovered: props.recovered === true,
  })
  const actions = useActions({
    props,
    model,
    draft,
  })
  const workspace = {
    props,
    model,
    draft,
    busy: actions.busy || resolving,
    run: actions.run,
    perform: actions.perform,
  }
  const update = (patch: Parameters<typeof model.updateFields>[0]): void => {
    model.updateFields(patch)
    draft.changed()
  }
  const schedules = useScheduleList(workspace)
  const livePath = useLivePath(workspace)
  const rich = useRichMetadata(model)
  return (
    <DraftPreviewProvider workspace={workspace}>
      <section className="workspace">
        <EditorHeader
          workspace={workspace}
          {...actions}
          livePath={livePath}
          schedules={schedules.data?.items ?? []}
        />
        <div className={layout1Class}>
          <div className={layout2Class}>
            <DraftNotices workspace={workspace} setResolving={setResolving} />
            <TitleField workspace={workspace} update={update} />
            <RichMetadataContext value={rich}>
              <EditorBody workspace={workspace} />
            </RichMetadataContext>
            <LocalCopyStatus value={draft.localNotice} />
          </div>
          <EditorSettings
            workspace={workspace}
            update={update}
            {...{ restore: actions.restore, livePath, schedules }}
          />
        </div>
      </section>
    </DraftPreviewProvider>
  )
}

function useLivePath(workspace: Workspace): string | null {
  const { documentId, livePath: initialPath, liveRevisionId: initialLive } = workspace.props.initial
  const { liveRevisionId } = workspace.draft.ack
  const [verified, setVerified] = useState({ revision: initialLive, path: initialPath })
  useEffect(() => {
    if (liveRevisionId === null || liveRevisionId === verified.revision) {
      return
    }
    let active = true
    void get(`/api/admin/documents/${documentId}`, openDocumentSchema)
      .then((document) => {
        if (active && document.liveRevisionId === liveRevisionId) {
          setVerified({ revision: document.liveRevisionId, path: document.livePath })
        }
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [
    documentId,
    liveRevisionId,
    verified.revision,
  ])
  return liveRevisionId === verified.revision ? verified.path : null
}

function TitleField({
  workspace,
  update,
}: {
  workspace: Workspace
  update: (patch: Partial<Envelope>) => void
}): ReactNode {
  const { model, busy } = workspace
  const text = useBlogTranslation('editor').t
  return (
    <Label className={cn('grid gap-2', [
      utility5Class,
      '[&_input]:rounded-none [&_input]:bg-transparent',
      '[&_input]:text-[length:clamp(30px,_3.2vw,_40px)] [&_input]:font-semibold',
      utility6Class,
      utility7Class,
      '[&_.field-label]:w-px [&_.field-label]:h-px [&_.field-label]:overflow-hidden',
      '[&_.field-label]:[clip-path:inset(50%)] [&_.field-label]:whitespace-nowrap',
    ].join(' '))}
    >
      <span className={utility8Class}>{text('title2')}</span>
      <Input
        disabled={busy}
        maxLength={200}
        placeholder={text('untitled')}
        value={model.envelope.meta.title}
        onChange={event =>
          update({
            meta: {
              ...model.envelope.meta,
              title: event.currentTarget.value,
            },
          })}
      />
    </Label>
  )
}

function LocalCopyStatus({ value }: { value: string }): ReactNode {
  const text = useEditorLabels()
  const prefix = 'Local copy saved '
  const saved = value.startsWith(prefix)
  if (value === '') {
    return null
  }
  return (
    <p className={layout3Class} role="status" data-state={saved ? 'saved' : 'unavailable'}>
      {saved
        ? <FileCheck2 size={14} aria-hidden="true" />
        : <CircleAlert size={14} aria-hidden="true" />}
      <span>
        {saved
          ? text('Local copy saved {{value0}}', { value0: value.slice(prefix.length) })
          : text(value)}
      </span>
    </p>
  )
}
