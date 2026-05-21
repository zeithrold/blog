'use client'

import type { ExtendedRecordMap } from 'notion-types'
import { NotionRenderer } from 'react-notion-x'
import { Code, Collection, Equation, Modal, Pdf } from './dynamic-imports'

interface NotionPageProps {
  recordMap: ExtendedRecordMap
}

/**
 *
 */
export function NotionPage({ recordMap }: NotionPageProps) {
  return (
    <div className="notion-article">
      <NotionRenderer
        recordMap={recordMap}
        fullPage={false}
        darkMode={false}
        components={{
          Code,
          Collection,
          Equation,
          Pdf,
          Modal,
        }}
      />
    </div>
  )
}
