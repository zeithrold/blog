'use client'
import dynamic from 'next/dynamic'
import { LoadingEditor } from '@/features/editor/ui/editor-loading'

export const DynamicEditor = dynamic(
  async () => {
    performance.mark('cms-editor-start')
    return await import('@/features/editor/ui/editor-entry')
  },
  {
    ssr: false,
    loading: LoadingEditor,
  },
)
