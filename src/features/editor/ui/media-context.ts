import type { EditorUploadModel } from '@/features/editor/services/editor-upload-model'
import { createContext } from 'react'

export const EditorMediaContext = createContext<EditorUploadModel | null>(null)
