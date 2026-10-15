import type { EditorProps } from '@/features/editor/core/editor-types'
import { openDocumentSchema, sessionSchema } from '@/content/contracts'
import { APIError, get } from '@/features/editor/services/api-client'

export async function loadEditorEntry(
  documentId: string,
  owner: string,
  signal: AbortSignal,
): Promise<EditorProps> {
  const session = await get('/api/admin/session', sessionSchema, signal)
  if (session.ownerSub !== owner) {
    throw new APIError(401, 'AUTH_INVALID')
  }
  const initial = await get(`/api/admin/documents/${documentId}`, openDocumentSchema, signal)
  return { initial, owner, csrfToken: session.csrfToken }
}
