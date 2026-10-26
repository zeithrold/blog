/* eslint-disable react-refresh/only-export-components -- A harness module, not a Fast Refresh boundary. */
import type { ReactNode } from 'react'
import type { Stub } from './history-page-support'
import type { PageLocale } from './history-state-support'
import type { OpenDocument } from '@/contracts/documents'
import type { RecoveryNoticeWorkspace } from '@/features/editor/draft/notices'
import type { Recovery } from '@/features/editor/draft/recovery'
import { useState } from 'react'
import { RecoveryNotice } from '@/features/editor/draft/notices'
import { historyCase } from '~/tests/components/support/history-fixtures'
import { serveFetch } from './history-page-support'
import { draftDocument, recoverySavedAt, recoveryText, savedText } from './history-preview-remaining-support'
import { renderElement } from './history-state-support'

/**
 * The local recovery notice over a real session reopen seam.
 *
 * The `local` value is the notice's own input; the IndexedDB read that produces
 * it, the reload and the editor that applies it stay in the browser case.
 */
export function mountRecoveryNotice(locale: PageLocale): {
  readonly stub: Stub
  readonly local: Recovery
  readonly reopens: readonly { readonly document: OpenDocument, readonly recovered: boolean }[]
} {
  const fixture = historyCase({ body: savedText, latestBody: savedText })
  const reopens: { document: OpenDocument, recovered: boolean }[] = []
  const workspace = {
    props: {
      initial: fixture.initial,
      owner: 'dom-history-preview',
      csrfToken: 'dom-history-preview-csrf',
      reopen: (document: OpenDocument, recovered = false) => {
        reopens.push({ document, recovered })
      },
    },
    busy: false,
  }
  const local: Recovery = {
    owner: workspace.props.owner,
    documentId: fixture.initial.documentId,
    baseRevisionId: fixture.initial.headRevisionId,
    editSeq: 1,
    savedAt: recoverySavedAt,
    document: draftDocument(fixture.initial.document, recoveryText),
  }
  const stub = serveFetch({})
  renderElement(<LocalRecovery workspace={workspace} local={local} />, locale)
  return { stub, local, reopens }
}

function LocalRecovery({ workspace, local }: {
  workspace: RecoveryNoticeWorkspace
  local: Recovery
}): ReactNode {
  // The same transition `DraftNotices` performs when the notice is dismissed.
  const [current, setCurrent] = useState<Recovery | null>(local)
  return current === null
    ? null
    : <RecoveryNotice workspace={workspace} local={current} dismiss={() => { setCurrent(null) }} />
}
