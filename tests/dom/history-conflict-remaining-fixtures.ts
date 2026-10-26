import type { Locale } from '@/components/ui/ztd-me'
import type { Document } from '@/content/document'
import type { OpenDocument } from '@/contracts/documents'
import { historyCase, openDocument } from '~/tests/components/support/history-fixtures'
import { deferred } from './publication-stub'

/*
 * The documents, paragraphs and copy the conflict cases compare.
 *
 * The drafts come from the same `historyCase` source of truth the component
 * cases use, so a conflict here is the conflict the API would describe. The copy
 * is an accepted literal table, not a lookup into the product resources: an
 * expectation computed from the table the component renders from could never
 * disagree with it.
 */

/**
 * The paragraphs the conflict cases compare: the one the other window saved and
 * the one this window keeps before the operator decides.
 */
export const conflictTexts = {
  server: 'The server paragraph saved by the other window',
  local: 'The local paragraph that remains preserved in this window',
  updated: 'The updated local paragraph after comparing both drafts',
} as const

/**
 * The draft this editor holds and the newer draft another window saved: the same
 * block ids, so comparing them is one changed paragraph rather than an add and a
 * removal.
 */
export function conflictDocuments(): { local: OpenDocument, remote: OpenDocument } {
  const fixture = historyCase({
    title: 'The local draft title',
    body: 'The paragraph before the two windows diverged',
    latestBody: 'The paragraph before the two windows diverged',
  })
  const local = openDocument(fixture, { liveRevisionId: null, livePath: null })
  const remote = openDocument(fixture, {
    version: local.version + 1,
    headRevisionId: crypto.randomUUID(),
    liveRevisionId: null,
    livePath: null,
    document: withParagraph(local.document, conflictTexts.server),
  })
  return { local, remote }
}

function withParagraph(document: Document, text: string): Document {
  const value = structuredClone(document)
  const block = value.blocks[0]
  if (block === undefined) {
    throw new Error('The conflict fixture has no paragraph')
  }
  block.content = [
    { type: 'text', text, styles: {} },
  ]
  return value
}

/** The conflict copy the real draft notices render, accepted once per locale. */
export type ConflictCopy = {
  readonly title: string
  readonly description: string
  readonly pending: string
  readonly pendingHelp: string
  readonly comparison: string
  readonly compare: string
  readonly differences: string
  readonly before: string
  readonly after: string
  readonly keep: string
  readonly open: string
  readonly keepHelp: string
  readonly openHelp: string
  readonly stale: string
  readonly cancel: string
}

const accepted: Readonly<Record<Locale, ConflictCopy>> = {
  'en': {
    title: 'Draft conflict',
    description: 'This draft was updated elsewhere. Your local edits are preserved.',
    pending: 'Draft changed elsewhere',
    pendingHelp: 'Your edits are preserved. Review the latest draft before continuing.',
    comparison: 'Conflict comparison',
    compare: 'Compare changes',
    differences: 'Revision differences',
    before: 'Server draft',
    after: 'Local draft snapshot',
    keep: 'Keep local edits',
    open: 'Use server version',
    keepHelp: 'Save as a new draft revision.',
    openHelp: 'Your local edits stay in a recovery copy.',
    stale: 'Local content changed after this comparison. Compare again to update the differences.',
    cancel: 'Cancel',
  },
  'zh-CN': {
    title: '草稿存在冲突',
    description: '草稿已在其他位置更新，你的修改已保留。',
    pending: '草稿已在其他位置更新',
    pendingHelp: '你的修改已保留，请先核对最新草稿再继续。',
    comparison: '冲突内容对比',
    compare: '查看差异',
    differences: '修订差异',
    before: '服务器草稿',
    after: '本地草稿快照',
    keep: '保留本地修改',
    open: '使用服务器版本',
    keepHelp: '保存为新的草稿修订。',
    openHelp: '本地修改会保留为恢复副本。',
    stale: '本地内容已继续修改，请再次对比以更新差异。',
    cancel: '取消',
  },
}

export function conflictCopy(locale: Locale): ConflictCopy {
  return accepted[locale]
}

/** A newer-draft read held until the case releases it, so the pending notice is observable. */
export type HeldReply = {
  readonly promise: Promise<void>
  readonly release: () => void
}

export function heldReply(): HeldReply {
  const gate = deferred<boolean>()
  return {
    promise: gate.promise.then(() => undefined),
    release: () => {
      gate.open(true)
    },
  }
}
