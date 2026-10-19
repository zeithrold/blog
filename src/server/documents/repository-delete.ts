import type { Acknowledgement } from '@/contracts/documents'
import type { Mutation, Row } from '@/server/documents/repository-types'
import { RevisionRepository } from '@/server/documents/repository-revisions'
import { Problem } from '@/server/http/problem'

export class DeletionRepository extends RevisionRepository {
  async restoreDeleted(id: string, version: number, mutation: Mutation): Promise<Acknowledgement> {
    const replay = await this.replay(mutation)
    if (replay !== null) {
      return replay
    }
    const row = await this.sql('SELECT * FROM documents WHERE id=?', id).first<Row>()
    if (row === null) {
      throw new Problem(404, 'DOCUMENT_NOT_FOUND')
    }
    const now = Date.now()
    const response = { ...this.ack(row), version: version + 1 }
    await this.commit(
      [
        this.writableGuard(
          mutation,
          `EXISTS(SELECT 1 FROM documents WHERE id=? AND version=?
            AND deleted_at IS NOT NULL AND live_revision_id IS NULL)`,
          [id, version],
        ),
        this.sql(
          'UPDATE documents SET deleted_at=NULL,updated_at=?,version=version+1 WHERE id=?',
          now,
          id,
        ),
        this.journal({ mutation, id, operation: 'restore-deleted', response, now }),
        this.end(mutation),
      ],
      mutation,
    )
    return (await this.replay(mutation)) ?? response
  }

  async deleteDocument(
    id: string,
    version: number,
    generation: number,
    mutation: Mutation,
  ): Promise<Acknowledgement> {
    const replay = await this.replay(mutation)
    if (replay !== null) {
      return replay
    }
    const row = await this.row(id)
    const now = Date.now()
    const response = { ...this.ack(row), version: version + 1 }
    await this.commit(
      [
        this.guard({
          id,
          version,
          mutation,
          extra: 'AND live_revision_id IS NULL AND live_generation=?',
          values: [generation],
        }),
        this.sql(
          'UPDATE documents SET deleted_at=?,updated_at=?,version=version+1 WHERE id=?',
          now,
          now,
          id,
        ),
        this.sql(
          'UPDATE schedules SET state=\'cancelled\',updated_at=? WHERE document_id=? AND state=\'pending\'',
          now,
          id,
        ),
        this.journal({ mutation, id, operation: 'delete', response, now }),
        this.end(mutation),
      ],
      mutation,
    )
    return (await this.replay(mutation)) ?? response
  }
}
