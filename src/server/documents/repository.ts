import type { D1PreparedStatement } from '@cloudflare/workers-types/index.ts'
import type { Document } from '@/content/document'
import type { Acknowledgement } from '@/contracts/documents'
import type { Mutation, Row } from '@/server/documents/repository-types'
import { extractText, hanTokens } from '@/content/canonical'
import { validateDocument } from '@/content/document'
import { DeletionRepository } from '@/server/documents/repository-delete'
import { Problem } from '@/server/http/problem'

export type { Mutation } from '@/server/documents/repository-types'
export type PublishInput = {
  id: string
  expectedVersion: number
  expectedLiveGeneration: number
  revisionId: string | null
}

type SchedulePublication = {
  id: string
  now: number
}

type Publication = {
  input: PublishInput
  mutation: Mutation
  row: Row
  target: Document | null
  now: number
  unchanged: boolean
  ack: Acknowledgement
}

export class Repository extends DeletionRepository {
  private async publication(input: PublishInput, mutation: Mutation): Promise<Publication> {
    const row = await this.row(input.id)
    if (
      row.version !== input.expectedVersion
      || row.live_generation !== input.expectedLiveGeneration
    ) {
      throw new Problem(409, 'EDIT_CONFLICT')
    }
    const target
      = input.revisionId === null
        ? null
        : (await this.revision(input.id, input.revisionId)).document
    if (target !== null) {
      validateDocument(target, true)
    }
    const unchanged = input.revisionId === null && row.live_revision_id === null
    const ack = unchanged
      ? {
          ...this.ack(row),
          unchanged: true,
        }
      : {
          ...this.ack(row),
          liveRevisionId: input.revisionId,
          version: input.expectedVersion + 1,
          liveGeneration: input.expectedLiveGeneration + 1,
        }
    return {
      input,
      mutation,
      row,
      target,
      now: Date.now(),
      unchanged,
      ack,
    }
  }

  private projection({ input, row, target, now }: Publication): D1PreparedStatement[] {
    if (target === null) {
      return []
    }
    const text = extractText(target).normalize('NFKC')
    if (new TextEncoder().encode(text).byteLength > 524288) {
      throw new Problem(422, 'SEARCH_PROJECTION_TOO_LARGE')
    }
    return [
      this.sql(
        `INSERT INTO published_documents(document_id,revision_id,path,kind,title,description,
      document_locale,plain_text,cjk_bigrams,published_at,updated_at,searchable)
VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
        input.id,
        input.revisionId,
        `/${row.kind === 'article' ? 'posts' : 'pages'}/${target.meta.slug}`,
        row.kind,
        target.meta.title,
        target.meta.description,
        target.meta.documentLocale,
        text,
        hanTokens(text),
        row.first_published_at ?? now,
        now,
        target.meta.seo.noindex ? 0 : 1,
      ),
      this.publicationCatalog(input.id, target),
    ]
  }

  private publicationStatements(publication: Publication): D1PreparedStatement[] {
    const { input, mutation, now, ack } = publication
    if (publication.unchanged) {
      return []
    }
    return [
      this.sql(
        `UPDATE documents SET
live_revision_id=?,live_generation=live_generation+1,version=version+1,updated_at=?,
        first_published_at=CASE WHEN ? IS NULL THEN first_published_at ELSE
COALESCE(first_published_at,?) END,
        last_published_at=CASE WHEN ? IS NULL THEN last_published_at ELSE ? END WHERE
id=?`,
        input.revisionId,
        now,
        input.revisionId,
        now,
        input.revisionId,
        now,
        input.id,
      ),
      this.sql('DELETE FROM published_catalog WHERE document_id=?', input.id),
      this.sql('DELETE FROM published_documents WHERE document_id=?', input.id),
      ...this.projection(publication),
      this.sql(
        `INSERT INTO
publication_events(id,document_id,operation,revision_id,live_generation,actor_sub,happened_at)
        VALUES(?,?,?,?,?,?,?)`,
        crypto.randomUUID(),
        input.id,
        input.revisionId === null ? 'unpublish' : 'publish',
        input.revisionId,
        ack.liveGeneration,
        mutation.actor,
        now,
      ),
      this.sql('UPDATE site_state SET public_generation=public_generation+1 WHERE id=1'),
    ]
  }

  private publicationGuard(
    input: PublishInput,
    mutation: Mutation,
    schedule?: SchedulePublication,
  ): D1PreparedStatement {
    let extra = 'AND live_generation=?'
    const values: (string | number)[] = [input.expectedLiveGeneration]
    if (schedule !== undefined) {
      extra += ` AND EXISTS(SELECT 1 FROM schedules WHERE id=? AND document_id=documents.id AND state='pending'
        AND revision_id=? AND expected_live_generation=? AND run_at<=? AND next_attempt_at<=?)`
      values.push(
        schedule.id,
        input.revisionId ?? '',
        input.expectedLiveGeneration,
        schedule.now,
        schedule.now,
      )
    }
    return this.guard({
      id: input.id,
      version: input.expectedVersion,
      mutation,
      extra,
      values,
    })
  }

  async publish(
    input: PublishInput,
    mutation: Mutation,
    schedule?: SchedulePublication,
  ): Promise<Acknowledgement> {
    const replay = await this.replay(mutation)
    if (replay !== null) {
      return replay
    }
    const publication = await this.publication(input, mutation)
    const { now, ack } = publication
    const jobs
      = schedule === undefined
        ? this.sql(
            'UPDATE schedules SET state=\'cancelled\',updated_at=? WHERE document_id=? AND state=\'pending\'',
            now,
            input.id,
          )
        : this.sql(
            'UPDATE schedules SET state=\'done\',updated_at=?,error_code=NULL WHERE id=? AND state=\'pending\'',
            now,
            schedule.id,
          )
    await this.commit(
      [
        this.publicationGuard(input, mutation, schedule),
        ...this.publicationStatements(publication),
        jobs,
        this.journal({
          mutation,
          id: input.id,
          operation: input.revisionId === null ? 'unpublish' : 'publish',
          response: ack,
          now,
        }),
        this.end(mutation),
      ],
      mutation,
    )
    return (await this.replay(mutation)) ?? ack
  }
}
