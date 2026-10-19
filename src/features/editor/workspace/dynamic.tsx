'use client'
import dynamic from 'next/dynamic'
import { LoadingEditor } from '@/features/editor/workspace/editor-loading'

export const DynamicEditor = dynamic(
  async () => {
    performance.mark('cms-editor-start')
    return await import('@/features/editor/workspace/editor-entry')
  },
  {
    ssr: false,
    loading: LoadingEditor,
  },
)
