import type { EditorProps } from '@/features/editor/workspace/editor-types'
import { openDocumentSchema } from '@/contracts/documents'
import { sessionSchema } from '@/contracts/session'
import { APIError, get } from '@/shared/admin/api-client'

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
