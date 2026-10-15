import type { ReactNode } from 'react'
import type { Workspace } from '@/features/editor/core/editor-types'
import type { ScheduleModel } from '@/features/editor/services/schedule-controller'
import { ChoiceSelect } from '@/components/ui/choice-select'
import { DatePicker } from '@/components/ui/date-picker'
import { Badge, Button, Input, Label } from '@/components/ui/ztd-me/client'
import { SettingSection } from '@/components/ui/ztd-me/ui/setting-section'
import { ScheduleTimezone } from '@/features/editor/ui/schedule-timezone'
import { EditorText } from '@/i18n/labels'
import { useEditorLabels } from '@/i18n/use-labels'

const utility1Class = ['schedule-list m-0 p-0 list-none [&_li]:mt-[14px] [&_li]:pt-[14px] [&_li]:border-t'].join(' ')

const utility2Class = ['editor-field-help m-0 text-muted-foreground text-help leading-[1.65] wrap-anywhere'].join(' ')

const utility3Class = ['editor-field-help m-0 text-muted-foreground text-help leading-[1.65] wrap-anywhere'].join(' ')

const utility4Class = ['editor-field-help m-0 text-muted-foreground text-help leading-[1.65] wrap-anywhere'].join(' ')

const layout1Class = [
  'schedule-time-form grid gap-5 my-5 [&_[role=status]]:m-0',
  '[&_[role=status]]:text-muted-foreground [&_[role=status]]:text-help',
  '[&_[role=status]:empty]:hidden',
].join(' ')

const layout2Class = [
  utility1Class,
  '[&_li]:border-border [&_li]:text-help [&_li]:leading-[1.8] [&_button]:mt-[10px]',
].join(' ')

export function ScheduleSettings({ workspace, model, open, setOpen }: {
  workspace: Workspace
  model: ScheduleModel
  open: boolean
  setOpen: (open: boolean) => void
}): ReactNode {
  const text = useEditorLabels()
  return (
    <SettingSection title={text('Scheduled publication')} open={open} onOpenChange={setOpen}>
      <p className={utility2Class}>
        <EditorText value="The plan publishes a fixed saved revision. Later edits stay in your draft." />
      </p>
      <ScheduleTime model={model} busy={workspace.busy} run={workspace.run} />
      <div className="grid grid-cols-2 gap-2 [&_button]:h-auto [&_button]:min-h-11 [&_button]:whitespace-normal">
        <Button
          variant="outline"
          type="button"
          disabled={model.busy || workspace.busy || model.chosen === ''}
          onClick={() => workspace.run(model.submit())}
        >
          <EditorText value="Schedule saved draft" />
        </Button>
        <Button
          variant="outline"
          type="button"
          disabled={model.loading || model.busy || workspace.busy}
          aria-busy={model.loading}
          onClick={() => workspace.run(model.load())}
        >
          <EditorText value="Load schedules" />
        </Button>
      </div>
      {model.listError && (
        <p className="schedule-list-error text-help text-destructive" role="alert">
          <EditorText value="Unable to load schedules." />
        </p>
      )}
      <ScheduleJobs workspace={workspace} model={model} />
    </SettingSection>
  )
}
function ScheduleTime({ model, busy, run }: {
  model: ScheduleModel
  busy: boolean
  run: Workspace['run']
}): ReactNode {
  const text = useEditorLabels()
  const [date = '', time = ''] = model.localTime.split('T')
  return (
    <div className={layout1Class}>
      <div className="schedule-time-fields grid grid-cols-[minmax(0,_1fr)_110px] gap-3">
        <Label className="grid gap-2">
          {text('Publication date')}
          <DatePicker
            label={text('Publication date')}
            value={date}
            disabled={model.busy || busy}
            onValueChange={next => model.update('localTime', `${next}T${time === '' ? '09:00' : time}`)}
          />
        </Label>
        <Label className="grid gap-2">
          {text('Publication time')}
          <Input
            type="time"
            disabled={model.busy || busy}
            value={time}
            onChange={event => model.update('localTime', `${date}T${event.currentTarget.value}`)}
          />
        </Label>
      </div>
      <ScheduleTimezone model={model} disabled={model.busy || busy} />
      <Button
        variant="outline"
        type="button"
        disabled={model.busy || busy || model.checking}
        aria-busy={model.checking}
        onClick={() => run(model.times())}
      >
        <EditorText value="Check timezone and DST" />
      </Button>
      <p role="status" aria-live="polite">
        <EditorText value={model.notice} />
      </p>
      <VerifiedScheduleTime model={model} busy={busy} />
    </div>
  )
}
function VerifiedScheduleTime({ model, busy }: { model: ScheduleModel, busy: boolean }): ReactNode {
  const text = useEditorLabels()
  return (
    <Label className="grid gap-2">
      <EditorText value="Verified UTC time" />
      <ChoiceSelect
        label={text('Verified UTC time')}
        value={model.chosen}
        onValueChange={model.setChosen}
        disabled={model.busy || busy}
        options={[
          { value: '', label: text('Choose time') },
          ...model.choices.map(choice => ({
            value: String(choice.runAt),
            label: `${new Date(choice.runAt).toISOString()} · `
              + `${text('UTC offset')} ${choice.utcOffset} ${text('min')}`,
          })),
        ]}
      />
    </Label>
  )
}

function ScheduleJobs({
  workspace,
  model,
}: {
  workspace: Workspace
  model: ScheduleModel
}): ReactNode {
  return (
    <ul className={layout2Class}>
      {model.items.map(item => (
        <li key={item.id}>
          {item.localTime}
          {' '}
          {item.timezone}
          {' '}
          ·
          {' '}
          <Badge variant={item.state === 'pending' ? 'warning' : 'secondary'}>
            <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
            <EditorText value={item.state} />
          </Badge>
          {' '}
          ·
          {' '}
          <EditorText value="attempts" />
          {' '}
          {item.attempts}
          {' '}
          {item.errorCode !== null && (
            <p className="schedule-error text-destructive">
              <EditorText value={item.errorCode} />
            </p>
          )}
          <ScheduleJobNotes item={item} headRevisionId={workspace.draft.ack.headRevisionId} />
          {item.state === 'pending' && (
            <Button
              variant="outline"
              type="button"
              disabled={model.busy || workspace.busy}
              onClick={() => workspace.run(model.submit(item.id))}
            >
              <EditorText value="Cancel schedule" />
            </Button>
          )}
        </li>
      ))}
    </ul>
  )
}

function ScheduleJobNotes({
  item,
  headRevisionId,
}: {
  item: ScheduleModel['items'][number]
  headRevisionId: string
}): ReactNode {
  return (
    <>
      <p className={utility3Class}>
        <EditorText
          value={
            item.revisionId === headRevisionId
              ? 'Scheduled revision matches the saved draft.'
              : 'This plan targets an earlier revision. Your newer draft will stay private.'
          }
        />
      </p>
      {item.state === 'pending' && item.attempts > 0 && (
        <p className={utility4Class}>
          <EditorText value="Next retry" />
          {' '}
          ·
          {new Date(item.nextAttemptAt).toISOString()}
        </p>
      )}
    </>
  )
}
