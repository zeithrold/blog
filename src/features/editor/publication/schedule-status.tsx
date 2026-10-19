import type { ReactNode } from 'react'
import type { ScheduleModel } from '@/features/editor/publication/schedule-controller'
import { Badge } from '@/components/ui/ztd-me/client'
import { EditorText } from '@/i18n/labels'

export function ScheduledStatus({ items }: { items: ScheduleModel['items'] }): ReactNode {
  const pending = items.find(item => item.state === 'pending')
  if (pending === undefined) {
    return null
  }
  return (
    <Badge variant="warning" title={`${pending.localTime} ${pending.timezone}`}>
      <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
      <EditorText value="Scheduled" />
    </Badge>
  )
}
