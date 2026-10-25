/** Expected history copy, asserted as text: a fixture for the translation contract. */
export type HistoryCopy = {
  readonly title: string
  readonly refresh: string
  readonly restore: string
  readonly publish: string
  readonly confirm: string
  readonly selected: string
  readonly compare: string
  readonly revision: string
  readonly currentDraft: string
  readonly restored: string
  readonly published: string
  readonly conflict: string
  readonly unconfirmed: string
  readonly refreshRequired: string
  readonly outcomeUnknown: string
  readonly maintenance: string
  readonly ownerRequired: string
  readonly requirements: readonly string[]
  readonly publicationIssues: readonly string[]
}

const en: HistoryCopy = {
  title: 'Revision history',
  refresh: 'Refresh history',
  restore: 'Restore as new draft',
  publish: 'Publish selected revision',
  confirm: 'Confirm',
  selected: 'Selected revision',
  compare: 'Compare against',
  revision: 'Revision',
  currentDraft: 'Current draft',
  restored: 'Created a new draft revision. The published revision is unchanged.',
  published: 'Published the selected revision. The draft revision is unchanged.',
  conflict: 'Another tab changed this document. Review the latest draft and differences before retrying.',
  unconfirmed: 'could not be confirmed',
  refreshRequired: 'The latest history could not be loaded. Refresh history before another operation.',
  outcomeUnknown: 'The operation result could not be confirmed. '
    + 'Refresh history to check the current state before trying again.',
  maintenance: 'Writes are paused for maintenance. Retry after maintenance ends.',
  ownerRequired: 'Your session cannot manage this document. Sign in as the owner.',
  requirements: ['Add a document title.', 'Use a valid, unreserved slug.'],
  publicationIssues: ['Add image alternative text or mark the image as decorative.', 'Add a caption to each table.'],
}

export const historyCopy: Readonly<Record<'en' | 'zh', HistoryCopy>> = {
  en,
  zh: {
    title: '修订历史',
    refresh: '刷新历史',
    restore: '恢复为新草稿',
    publish: '发布所选修订',
    confirm: '确认',
    selected: '所选修订',
    compare: '对比基准',
    revision: '修订',
    currentDraft: '当前草稿',
    restored: '已生成新的草稿修订。公开版本保持不变。',
    published: '所选修订已发布。草稿修订保持不变。',
    conflict: '另一标签页已修改文档。已加载最新草稿；请重新检查差异后重试。',
    unconfirmed: '暂时无法确认',
    refreshRequired: '未能加载最新历史。请先刷新历史，再进行其他操作。',
    outcomeUnknown: '暂时无法确认操作结果。请先刷新历史核对当前状态，再决定是否重试。',
    maintenance: '维护中已暂停写入，请稍后重试。',
    ownerRequired: '此会话无权管理文档，请以所有者身份登录。',
    requirements: ['请填写文档标题。', '请填写有效且非保留的 Slug。'],
    publicationIssues: ['请为图片填写替代文本，或标记为装饰图片。', '请为各表格填写标题说明。'],
  },
}
