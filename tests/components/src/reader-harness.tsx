'use client'
import type { ReactNode } from 'react'
import { DocumentReader } from '@/features/reader/document'
import { readerFixture } from './reader-fixtures'

/**
 * Reader-domain surface: the production reader renders a fixture document without
 * the editor, routing or Worker, so its content and typography stay provable here.
 */
export function ReaderSurface(): ReactNode {
  return <DocumentReader document={readerFixture()} />
}
