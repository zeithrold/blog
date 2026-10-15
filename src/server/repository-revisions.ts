import type { D1PreparedStatement } from '@cloudflare/workers-types/index.ts'
import type { Acknowledgement, Mutation, Row } from '@/server/repository-types'
import { canonicalize } from '@/content/canonical'
import { emptyDocument } from '@/content/document'
import { Problem } from '@/server/problem'
import { ReferenceRepository } from '@/server/repository-refs'

export type RevisionInput = {
  id: string
  expectedVersion: number
  baseRevisionId: string
  document: unknown
  reason: 'manual' | 'autosave' | 'restore'
  restoredFromId?: string
}

type Snapshot = Awaited<ReturnType<typeof canonicalize>>
type WriteJob = {
  input: RevisionInput
  snapshot: Snapshot
  revision: string
  mutation: Mutation
  now: number
}

export class RevisionRepository extends ReferenceRepository {
  private createStatements(job: {
    id: string
    kind: string
    revision: string
    snapshot: Snapshot
    now: number
    mutation: Mutation
  }): D1PreparedStatement[] {
    const { id, kind, revision, snapshot, now, mutation } = job
    return [
      this.writableGuard(mutation),
      this.sql(
        'INSERT INTO documents(id,kind,created_at,updated_at) VALUES(?,?,?,?)',
        id,
        kind,
        now,
        now,
      ),
      this.sql(
        `INSERT INTO revisions(id,document_id,sequence,schema_version,canonical_json,
        content_sha256,canonical_bytes,reason,actor_sub,created_at)
VALUES(?,?,1,1,?,?,?,'create',?,?)`,
        revision,
        id,
        snapshot.json,
        snapshot.hash,
        snapshot.bytes,
        mutation.actor,
        now,
      ),
      this.sql('UPDATE documents SET head_revision_id=? WHERE id=?', revision, id),
    ]
  }

  async create(kind: 'article' | 'page', mutation: Mutation): Promise<Acknowledgement> {
    const replay = await this.replay(mutation)
    if (replay !== null) {
      return replay
    }
    const id = crypto.randomUUID()
    const revision = crypto.randomUUID()
    const now = Date.now()
    const snapshot = await canonicalize(emptyDocument())
    await this.storageBudget(snapshot.bytes)
    const ack: Acknowledgement = {
      documentId: id,
      version: 0,
      headRevisionId: revision,
      liveRevisionId: null,
      liveGeneration: 0,
    }
    await this.commit(
      [
        ...this.createStatements({
          id,
          kind,
          revision,
          snapshot,
          now,
          mutation,
        }),
        this.journal({
          mutation,
          id,
          operation: 'create',
          response: ack,
          now,
        }),
        this.end(mutation),
      ],
      mutation,
    )
    return (await this.replay(mutation)) ?? ack
  }

  async save(input: RevisionInput, mutation: Mutation): Promise<Acknowledgement> {
    return await this.writeRevision(input, mutation)
  }

  async restore(
    id: string,
    version: number,
    revisionId: string,
    mutation: Mutation,
  ): Promise<Acknowledgement> {
    const replay = await this.replay(mutation)
    if (replay !== null) {
      return replay
    }
    const row = await this.row(id)
    const target = await this.revision(id, revisionId)
    return await this.writeRevision(
      {
        id,
        expectedVersion: version,
        baseRevisionId: row.head_revision_id,
        document: target.document,
        reason: 'restore',
        restoredFromId: revisionId,
      },
      mutation,
    )
  }

  private insertRevision({
    input,
    snapshot,
    revision,
    mutation,
    now,
  }: WriteJob): D1PreparedStatement[] {
    return [
      this.sql(
        `INSERT INTO revisions(id,document_id,sequence,parent_revision_id,restored_from_id,

schema_version,canonical_json,content_sha256,canonical_bytes,reason,actor_sub,created_at)
        SELECT ?,id,(SELECT MAX(sequence)+1 FROM revisions WHERE
document_id=?),head_revision_id,?,1,?,?,?,?,?,?
        FROM documents WHERE id=?`,
        revision,
        input.id,
        input.restoredFromId ?? null,
        snapshot.json,
        snapshot.hash,
        snapshot.bytes,
        input.reason,
        mutation.actor,
        now,
        input.id,
      ),
      ...this.referenceStatements(revision, snapshot.document),
      this.sql(
        'UPDATE documents SET head_revision_id=?,version=version+1,updated_at=? WHERE id=?',
        revision,
        now,
        input.id,
      ),
    ]
  }

  private async writeJob(
    input: RevisionInput,
    mutation: Mutation,
  ): Promise<{
    job: WriteJob
    row: Row
    unchanged: boolean
  }> {
    const row = await this.row(input.id)
    if (
      row.version !== input.expectedVersion
      || row.head_revision_id !== input.baseRevisionId
    ) {
      throw new Problem(409, 'EDIT_CONFLICT')
    }
    const snapshot = await canonicalize(input.document)
    await this.storageBudget(snapshot.bytes)
    const old = await this.revision(input.id, input.baseRevisionId)
    return {
      row,
      unchanged: snapshot.hash === old.contentSha256 && input.reason !== 'restore',
      job: {
        input,
        snapshot,
        revision: crypto.randomUUID(),
        mutation,
        now: Date.now(),
      },
    }
  }

  protected async writeRevision(
    input: RevisionInput,
    mutation: Mutation,
  ): Promise<Acknowledgement> {
    const replay = await this.replay(mutation)
    if (replay !== null) {
      return replay
    }
    const { job, row, unchanged } = await this.writeJob(input, mutation)
    const ack = unchanged
      ? {
          ...this.ack(row),
          unchanged: true,
        }
      : {
          ...this.ack(row),
          headRevisionId: job.revision,
          version: input.expectedVersion + 1,
        }
    const statements = [
      this.guard({
        id: input.id,
        version: input.expectedVersion,
        mutation,
        extra: 'AND head_revision_id=?',
        values: [input.baseRevisionId],
      }),
    ]
    if (!unchanged) {
      statements.push(...this.insertRevision(job))
    }
    statements.push(
      this.journal({
        mutation,
        id: input.id,
        operation: input.reason,
        response: ack,
        now: job.now,
      }),
      this.end(mutation),
    )
    await this.commit(statements, mutation)
    return (await this.replay(mutation)) ?? ack
  }
}
