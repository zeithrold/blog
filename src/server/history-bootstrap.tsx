import type { ReactNode } from 'react'
import { historyBootstrap } from '@/shared/admin/history-bootstrap'

export function HistoryBootstrap({ nonce }: { nonce: string }): ReactNode {
  // Fixed, self-contained startup code under the request CSP nonce; no authored data.
  /* eslint-disable react/dom-no-dangerously-set-innerhtml -- Fixed history code runs before router modules. */
  return <script nonce={nonce} dangerouslySetInnerHTML={{ __html: historyBootstrap }} />
  /* eslint-enable react/dom-no-dangerously-set-innerhtml */
}
