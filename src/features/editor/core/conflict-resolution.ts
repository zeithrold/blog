import type { Document } from '@/content/document'
import type { DraftCoordinator } from '@/features/editor/core/draft'
import type { Client, OpenDocument } from '@/features/editor/services/api-client'

export async function keepLocalRevision(
  input: {
    snapshot: () => Promise<Document>
    client: Pick<Client, 'write'>
    coordinator: Pick<DraftCoordinator, 'accept' | 'resumeAfterCorrection'>
  },
  remote: OpenDocument,
): Promise<void> {
  const document = await input.snapshot()
  const result = await input.client.write(
    `/api/admin/documents/${remote.documentId}/revisions`,
    'PUT',
    {
      expectedVersion: remote.version,
      baseRevisionId: remote.headRevisionId,
      reason: 'manual',
      document,
    },
  )
  // The live editor may receive a transaction after the snapshot, including
  // asynchronous native media updates. Keep that editor and save its latest
  // state against the new acknowledgement instead of reopening the old snapshot.
  input.coordinator.accept(result)
  input.coordinator.resumeAfterCorrection()
}
