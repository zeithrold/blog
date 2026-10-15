import type {
  D1Database,
  D1DatabaseSession,
  D1PreparedStatement,
} from '@cloudflare/workers-types/index.ts'
import type { z } from 'zod'
import type { Acknowledgement, Bind, Mutation, Row } from '@/server/repository-types'
import { acknowledgementSchema } from '@/content/contracts'
import { Problem } from '@/server/problem'

type JournalInput = {
  mutation: Mutation
  id: string | null
  operation: string
  response: unknown
  now: number
}

type GuardInput = {
  id: string
  version: number
  mutation: Mutation
  extra?: string
  values?: Bind[]
}

const constraintProblems: Record<string, [number, string]> = {
  'UNIQUE constraint': [409, 'PUBLICATION_CONFLICT'],
  'FOREIGN KEY constraint': [422, 'REFERENCE_NOT_FOUND'],
  'ASSET_NOT_READY': [422, 'ASSET_NOT_READY'],
  'ASSET_REFERENCED': [409, 'ASSET_REFERENCED'],
  'ASSET_BACKUP_PINNED': [409, 'ASSET_BACKUP_PINNED'],
  'STORAGE_LIMIT': [503, 'DATABASE_CAPACITY'],
}
export class RepositoryCore {
  protected readonly db: D1DatabaseSession
  constructor(database: D1Database) {
    this.db = database.withSession('first-primary')
  }

  protected sql(query: string, ...values: Bind[]): D1PreparedStatement {
    return this.db.prepare(query).bind(...values)
  }

  protected async row(id: string): Promise<Row> {
    const row = await this.sql(
      'SELECT * FROM documents WHERE id=? AND deleted_at IS NULL',
      id,
    ).first<Row>()
    if (row === null) {
      throw new Problem(404, 'DOCUMENT_NOT_FOUND')
    }
    return row
  }

  protected ack(row: Row): Acknowledgement {
    return {
      documentId: row.id,
      version: row.version,
      headRevisionId: row.head_revision_id,
      liveRevisionId: row.live_revision_id,
      liveGeneration: row.live_generation,
    }
  }

  protected async journalReplay(mutation: Mutation): Promise<unknown | null> {
    const row = await this.sql(
      'SELECT request_sha256,response_json FROM mutations WHERE request_id=?',
      mutation.key,
    ).first<{
      request_sha256: string
      response_json: string
    }>()
    if (row === null) {
      return null
    }
    if (row.request_sha256 !== mutation.hash) {
      throw new Problem(409, 'IDEMPOTENCY_KEY_REUSED')
    }
    const result: unknown = JSON.parse(row.response_json)
    return result
  }

  protected async replayAs<T>(mutation: Mutation, schema: z.ZodType<T>): Promise<T | null> {
    const result = await this.journalReplay(mutation)
    return result === null ? null : schema.parse(result)
  }

  async replay(mutation: Mutation): Promise<Acknowledgement | null> {
    return await this.replayAs(mutation, acknowledgementSchema)
  }

  protected async constraintError(error: unknown): Promise<never> {
    const message = error instanceof Error ? error.message : ''
    if (message.includes('guard_ok')) {
      const state = await this.sql('SELECT maintenance FROM site_state WHERE id=1').first<{
        maintenance: number
      }>()
      if (state?.maintenance === 1) {
        throw new Problem(503, 'MAINTENANCE')
      }
      throw new Problem(409, 'EDIT_CONFLICT')
    }
    for (const [marker, [status, code]] of Object.entries(constraintProblems)) {
      if (message.includes(marker)) {
        throw new Problem(status, code)
      }
    }
    throw error instanceof Error ? error : new Error('Database operation failed')
  }

  protected async commit(
    statements: D1PreparedStatement[],
    mutation: Mutation,
  ): Promise<void> {
    try {
      await this.db.batch(statements)
    }
    catch (error) {
      if ((await this.journalReplay(mutation)) !== null) {
        return
      }
      await this.constraintError(error)
    }
  }

  protected journal({
    mutation,
    id,
    operation,
    response,
    now,
  }: JournalInput): D1PreparedStatement {
    return this.sql(
      `INSERT INTO mutations
      (request_id,document_id,operation,request_sha256,response_json,committed_at)
VALUES(?,?,?,?,?,?)`,
      mutation.key,
      id,
      operation,
      mutation.hash,
      JSON.stringify(response),
      now,
    )
  }

  protected guard({
    id,
    version,
    mutation,
    extra = '',
    values = [],
  }: GuardInput): D1PreparedStatement {
    return this.sql(
      `INSERT INTO txn_guards(id,ok) VALUES(?,COALESCE((SELECT version=? AND deleted_at IS NULL
AND
      (SELECT maintenance=0 FROM site_state WHERE id=1) ${extra} FROM documents WHERE id=?),0))`,
      mutation.key,
      version,
      ...values,
      id,
    )
  }

  protected writableGuard(
    mutation: Mutation,
    condition = '1',
    values: Bind[] = [],
  ): D1PreparedStatement {
    return this.sql(
      `INSERT INTO txn_guards(id,ok) SELECT ?,maintenance=0 AND (${condition}) FROM site_state WHERE id=1`,
      mutation.key,
      ...values,
    )
  }

  protected async databaseBytes(): Promise<number> {
    const result = await this.sql('SELECT public_generation FROM site_state WHERE id=1').all()
    const bytes = result.meta.size_after
    if (!Number.isSafeInteger(bytes) || bytes < 0) {
      throw new Problem(503, 'DATABASE_CAPACITY_UNKNOWN')
    }
    return bytes
  }

  protected async storageBudget(additionalBytes: number): Promise<void> {
    const bytes = await this.databaseBytes()
    if (bytes + additionalBytes * 2 + 1048576 >= 8589934592) {
      throw new Problem(503, 'DATABASE_CAPACITY')
    }
  }

  protected end(mutation: Mutation): D1PreparedStatement {
    return this.sql('DELETE FROM txn_guards WHERE id=?', mutation.key)
  }
}
