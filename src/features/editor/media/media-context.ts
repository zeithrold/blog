import type { EditorUploadModel } from '@/features/editor/media/editor-upload-model'
import { createContext } from 'react'

export const EditorMediaContext = createContext<EditorUploadModel | null>(null)
