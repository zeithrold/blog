import type { ChoiceOption } from '@/components/ui/choice-select'
import type { HistoryModel } from '@/features/history/history-page-model'
import type { BlogTranslator } from '@/i18n/instance'

export function revisionLabel(id: string, model: HistoryModel, text: BlogTranslator<'editor'>): string {
  const revision = model.history.items.find(item => item.revisionId === id)
  if (revision !== undefined) {
    return `${text('revision')} ${revision.sequence}`
  }
  if (id === model.current.headRevisionId) {
    return text('currentDraft')
  }
  return id === model.current.liveRevisionId ? text('live') : text('savedRevision')
}

export function revisionOptions(model: HistoryModel, text: BlogTranslator<'editor'>): ChoiceOption[] {
  const extra = [
    model.selected.revisionId,
    model.baseline.revisionId,
    model.current.headRevisionId,
    model.current.liveRevisionId,
  ].filter((id): id is string => id !== null && !model.history.items.some(revision => revision.revisionId === id))
  return [
    ...Array.from(new Set(extra)).map(id => ({ value: id, label: revisionLabel(id, model, text) })),
    ...model.history.items.map(revision => ({
      value: revision.revisionId,
      label: `${text('revision')} ${revision.sequence}${
        revision.revisionId === model.current.headRevisionId ? text('currentDraft2') : ''
      }${revision.revisionId === model.current.liveRevisionId ? text('published') : ''}`,
    })),
  ]
}

export function revisionTime(timestamp: number, locale: string): string {
  return new Date(timestamp).toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function revisionReason(reason: string, text: BlogTranslator<'editor'>): string {
  const labels: Record<string, string> = {
    create: text('created'),
    manual: text('manualSave'),
    autosave: text('autosave'),
    restore: text('restoredRevision'),
  }
  return labels[reason] ?? reason
}
