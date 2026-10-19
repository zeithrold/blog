import type { ReactNode } from 'react'
import type { DraftStatus } from '@/features/editor/draft/draft'
import { Badge } from '@/components/ui/ztd-me/client'
import { useEditorLabels } from '@/i18n/use-labels'

const labels: Record<DraftStatus, string> = {
  saved: 'Saved',
  dirty: 'Unsaved changes',
  saving: 'Saving…',
  offline: 'Offline — server save pending',
  conflict: 'Conflict — draft preserved',
  error: 'Save failed',
}

const tones: Record<DraftStatus, 'neutral' | 'warning' | 'danger'> = {
  saved: 'neutral',
  dirty: 'warning',
  saving: 'neutral',
  offline: 'warning',
  conflict: 'danger',
  error: 'danger',
}
const variants = { neutral: 'secondary', warning: 'warning', danger: 'destructive' } as const

export function SaveStatus({ status, className = '' }: {
  status: DraftStatus
  className?: string
}): ReactNode {
  const text = useEditorLabels()
  return (
    <Badge
      variant={variants[tones[status]]}
      className={`admin-save-status ${className}`}
      data-status={status}
      data-tone={tones[status]}
      role="status"
    >
      <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
      {text(labels[status])}
    </Badge>
  )
}
