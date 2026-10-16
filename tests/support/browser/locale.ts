import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export type Locale = 'en' | 'zh'
export const labels = {
  en: {
    body: 'Document body',
    settings: 'Document settings',
    content: 'Content',
    publication: 'Publication',
    preview: 'Preview',
    dialog: 'Draft preview',
    reader: 'Draft reader preview',
    closePreview: 'Close preview',
    close: 'Close',
    more: 'More document actions',
    recovery: 'Local recovery copy',
    recover: 'Open recovered draft',
    dismiss: 'Dismiss',
    history: 'Revision history',
    revision: 'Revision',
    selected: 'Selected revision',
    baseline: 'Compare against',
    saved: 'Saved',
    historical: 'Preview selected revision',
    restore: 'Restore',
  },
  zh: {
    body: '正文',
    settings: '文档设置',
    content: '内容',
    publication: '发布',
    preview: '预览',
    dialog: '草稿预览',
    reader: '草稿阅读预览',
    closePreview: '关闭预览',
    close: '关闭',
    more: '更多文档操作',
    recovery: '本地恢复副本',
    recover: '打开恢复的草稿',
    dismiss: '忽略',
    history: '修订历史',
    revision: '修订',
    selected: '所选修订',
    baseline: '对比基准',
    saved: '已保存',
    historical: '预览所选修订',
    restore: '恢复',
  },
} as const

export async function setLocale(page: Page, locale: Locale): Promise<void> {
  if (locale === 'zh') {
    await page.getByRole('combobox', { name: 'Language', exact: true }).click()
    await page.getByRole('option', { name: '简体中文', exact: true }).click()
    await page.reload()
    await expect(page.getByLabel(labels.zh.body, { exact: true })).toBeVisible()
  }
}

export async function setChinese(page: Page): Promise<void> {
  await page.getByRole('combobox', { name: 'Language', exact: true }).click()
  await page.getByRole('option', { name: '简体中文', exact: true }).click()
  // BlockNote keeps its native dictionary for the lifetime of the editor session.
  await page.reload()
  await expect(page.getByLabel('正文', { exact: true })).toBeVisible()
}
