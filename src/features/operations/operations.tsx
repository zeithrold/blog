'use client'
import type { ReactNode } from 'react'
import type { z } from 'zod'
import type { operationsSchema } from '@/contracts/operations'
import { Activity, RefreshCw, ShieldCheck } from 'lucide-react'
import { Button, useFrontendPreferences } from '@/components/ui/ztd-me/client'
import { useOperations } from '@/features/operations/operations-model'
import { EditorText } from '@/i18n/labels'
import { useEditorLabels } from '@/i18n/use-labels'
import { ConfirmDialog } from '@/shared/admin/confirm-dialog'
import { AdminFeedback } from '@/shared/admin/feedback'
import { announceConfirmed } from '@/shared/admin/toast-feedback'
import {
  layout1Class,
  layout2Class,
  layout3Class,
  layout5Class,
  layout6Class,
  layout7Class,
  layout8Class,
} from './operations-layout'
import {
  utility1Class,
  utility2Class,
  utility3Class,
  utility4Class,
  utility5Class,
  utility6Class,
} from './operations-utilities'

const RESTORE_NOTE
  = 'Review the restored documents, private previews, media and owner access '
    + 'before resuming writes.'

type OperationsData = z.infer<typeof operationsSchema>
export function OperationsPanel({ csrfToken }: { csrfToken: string }): ReactNode {
  const model = useOperations(csrfToken)
  const text = useEditorLabels()
  return (
    <section className={layout1Class}>
      <header className={layout2Class}>
        <div>
          <h1 className={layout3Class}>
            <EditorText value="Operations" />
          </h1>
        </div>
        <Button
          variant="outline"
          type="button"
          disabled={model.loading || model.busy}
          onClick={() => {
            model.refresh().catch(() => {})
          }}
        >
          <RefreshCw size={16} aria-hidden="true" />
          <EditorText value="Refresh status" />
        </Button>
      </header>
      <p className={[utility1Class, 'leading-[1.6]'].join(' ')}>
        <EditorText value="Review storage, publication jobs and recovery before making operational changes." />
      </p>
      <AdminFeedback loading={model.loading} error={model.error} retry={model.refresh} />
      {model.data !== null && <OperationDetails data={model.data} model={model} />}
      <RefreshedAt value={model.updatedAt} />
      {model.confirm && (
        <ConfirmDialog
          title={text('Resume writes after checking restored content, media and owner access?')}
          close={() => model.setConfirm(false)}
          accept={() => {
            model.setConfirm(false)
            announceConfirmed(model.resume(), text('Writes resumed.'))
          }}
        />
      )}
    </section>
  )
}

function OperationDetails({
  data,
  model,
}: {
  data: OperationsData
  model: ReturnType<typeof useOperations>
}): ReactNode {
  return (
    <>
      <div className={layout5Class} data-state={data.maintenance === 1 ? 'warning' : 'ok'}>
        <ShieldCheck size={20} aria-hidden="true" />
        <div>
          <h2>
            <EditorText value={data.maintenance === 1 ? 'Paused for maintenance' : 'Workspace is writable'} />
          </h2>
          <p>
            <EditorText
              value={
                data.maintenanceOwner !== null
                  ? 'A backup owns the maintenance lock. Writes resume when that backup finishes.'
                  : 'Publication and storage status from the current database.'
              }
            />
          </p>
        </div>
        <span className={layout6Class}>
          <EditorText value="Public generation" />
          {' '}
          {data.publicGeneration}
        </span>
      </div>
      <OperationStats data={data} />
      <PublicationStats data={data} />
      {data.maintenance === 1 && data.maintenanceOwner === null && (
        <div className={layout7Class}>
          <p>
            <EditorText value={RESTORE_NOTE} />
          </p>
          <Button
            variant="default"
            type="button"

            disabled={model.busy || model.loading}
            onClick={(event) => {
              event.currentTarget.focus()
              model.setConfirm(true)
            }}
          >
            <EditorText value="Resume restored database writes" />
          </Button>
        </div>
      )}
    </>
  )
}

const capacityLabels = {
  normal: 'Normal capacity',
  warning: 'Approaching capacity',
  critical: 'Capacity critical',
} as const
function OperationStats({ data }: { data: OperationsData }): ReactNode {
  const text = useEditorLabels()
  const locale = useFrontendPreferences().preferences.locale
  return (
    <>
      <h2 className={[utility2Class, 'font-semibold'].join(' ')}>
        <Activity size={16} aria-hidden="true" />
        <EditorText value="Storage and content" />
      </h2>
      <dl className={utility3Class}>
        <Stat
          label="Database capacity"
          state={data.capacity === 'normal' ? 'ok' : data.capacity}
          value={formatBytes(data.databaseBytes, locale)}
          detail={text(capacityLabels[data.capacity])}
        />
        <Stat
          label="Canonical history"
          value={formatBytes(data.contentBytes, locale)}
          detail={`${data.revisions} ${text('revisions')}`}
        />
        <Stat
          label="Ready media"
          value={formatBytes(data.assetBytes, locale)}
          detail={`${data.readyAssets} ${text('assets')}`}
        />
        <Stat
          label="Documents"
          value={String(data.documents)}
          detail={`${data.searchableDocuments} ${text('searchable publications')}`}
        />
      </dl>
    </>
  )
}
function PublicationStats({ data }: { data: OperationsData }): ReactNode {
  const text = useEditorLabels()
  const lag = data.scheduleLagMs > 300000 ? 'critical' : 'ok'
  return (
    <>
      <h2 className={[utility4Class, 'font-semibold'].join(' ')}>
        <EditorText value="Publication" />
      </h2>
      <dl className={utility5Class}>
        <Stat label="Pending schedules" value={String(data.pendingSchedules)} />
        <Stat
          label="Schedule lag"
          state={lag}
          value={`${Math.round(data.scheduleLagMs / 1000)} s`}
          detail={text(
            lag === 'critical'
              ? 'Publication is more than five minutes overdue.'
              : 'Measured from the oldest pending publication.',
          )}
        />
        <Stat
          label="Failed schedules"
          state={data.failedSchedules > 0 ? 'critical' : 'ok'}
          value={String(data.failedSchedules)}
        />

      </dl>
    </>
  )
}
function formatBytes(bytes: number, locale: string): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(bytes / 1048576)} MiB`
}
function Stat({
  label,
  value,
  detail,
  state,
}: {
  label: string
  value: string
  detail?: string
  state?: 'ok' | 'warning' | 'critical'
}): ReactNode {
  return (
    <div className={layout8Class} data-state={state}>
      <dt>
        <EditorText value={label} />
      </dt>
      <dd>
        <span className={utility6Class}>{value}</span>
        {detail !== undefined && <span className="stat-detail text-muted-foreground text-help">{detail}</span>}
      </dd>
    </div>
  )
}

function RefreshedAt({ value }: { value: number | null }): ReactNode {
  const locale = useFrontendPreferences().preferences.locale
  return value === null
    ? null
    : (
        <p className="admin-feedback text-muted-foreground text-help">
          <EditorText value="Last refreshed" />
          {' · '}
          <time dateTime={new Date(value).toISOString()}>
            {new Date(value).toLocaleTimeString(locale)}
          </time>
        </p>
      )
}
