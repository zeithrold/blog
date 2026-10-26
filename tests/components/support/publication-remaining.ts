import type { Page } from '@playwright/test'
import type { ComponentLocale } from '../src/contract'
import { expect } from '@playwright/test'
import { openPublicationTab } from './editor-workspace-ui'
import { editorWorkspaceCopy } from './expected-copy'

/**
 * Labels and form operations the remaining publication component cases use.
 * The declared HTTP boundary lives in `publication-remaining-server.ts`.
 */
type SharedCopy = { [K in keyof typeof editorWorkspaceCopy.en]: string }
/** Labels these cases act on, including the shared editor workspace copy. */
export type PublicationCopy = SharedCopy & {
  more: string
  unpublish: string
  confirm: string
  updatePublication: string
  live: string
  conflict: string
  compare: string
  comparison: string
  serverVersion: string
  scheduledBadge: string
  loadSchedules: string
  cancelSchedule: string
  scheduleSavedDraft: string
  checkTime: string
  noTimezone: string
  timezoneError: string
  scheduleError: string
  close: string
}

export const publicationCopy: Record<ComponentLocale, PublicationCopy> = {
  en: {
    ...editorWorkspaceCopy.en,
    more: 'More document actions',
    unpublish: 'Unpublish',
    confirm: 'Confirm',
    updatePublication: 'Update publication',
    live: 'View live document',
    conflict: 'Draft conflict',
    compare: 'Compare changes',
    comparison: 'Conflict comparison',
    serverVersion: 'Use server version',
    scheduledBadge: 'Scheduled',
    loadSchedules: 'Load schedules',
    cancelSchedule: 'Cancel schedule',
    scheduleSavedDraft: 'Schedule saved draft',
    checkTime: 'Check timezone and DST',
    noTimezone: 'No matching timezone.',
    timezoneError: 'Enter a valid IANA timezone, such as Asia/Taipei or UTC.',
    scheduleError: 'A slug or series position is already in use. Check the conflicting entry.',
    close: 'Close',
  },
  zh: {
    ...editorWorkspaceCopy.zh,
    more: '更多文档操作',
    unpublish: '取消发布',
    confirm: '确认',
    updatePublication: '更新发布',
    live: '查看公开文档',
    conflict: '草稿存在冲突',
    compare: '查看差异',
    comparison: '冲突内容对比',
    serverVersion: '使用服务器版本',
    scheduledBadge: '已安排发布',
    loadSchedules: '加载发布计划',
    cancelSchedule: '取消发布计划',
    scheduleSavedDraft: '定时发布已保存草稿',
    checkTime: '核对时区与夏令时',
    noTimezone: '没有匹配的时区。',
    timezoneError: '请输入有效的 IANA 时区，例如 Asia/Taipei 或 UTC。',
    scheduleError: '路径或系列位置已被占用，请检查冲突项。',
    close: '关闭',
  },
}

export async function openScheduleForm(
  page: Page,
  locale: ComponentLocale = 'en',
): Promise<void> {
  const copy = publicationCopy[locale]
  await openPublicationTab(page, locale)
  const section = page.getByRole('button', { name: copy.schedule, exact: true })
  if (await section.getAttribute('aria-expanded') === 'false') {
    await section.click()
  }
}

export async function closeSettings(
  page: Page,
  locale: ComponentLocale = 'en',
): Promise<void> {
  const copy = publicationCopy[locale]
  const drawer = page.getByRole('dialog', { name: copy.settings, exact: true })
  if (await drawer.isVisible()) {
    await drawer.getByRole('button', { name: copy.close, exact: true }).click()
    await expect(drawer).toHaveCount(0)
  }
}
