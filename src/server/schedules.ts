import type { D1PreparedStatement } from '@cloudflare/workers-types/index.ts'
import type { z } from 'zod'
import type { scheduleInputSchema } from '@/content/service-contracts'
import type { Acknowledgement, Mutation } from '@/server/repository-types'
import { sha256 } from '@/content/canonical'
import { validateDocument } from '@/content/document'
import { scheduleAckSchema } from '@/content/service-contracts'
import { Problem } from '@/server/problem'
import { Repository } from '@/server/repository'
import { timeChoices } from '@/server/schedule-time'

type Job = {
  id: string
  document_id: string
  revision_id: string
  expected_live_generation: number
  attempts: number
  actor_sub: string
}

export class ScheduleRepository extends Repository {
  async schedules(id: string): Promise<{
    items: unknown[]
  }> {
    await this.row(id)
    const rows = await this.sql(
      `SELECT id,revision_id AS revisionId,state,run_at AS runAt,local_time AS localTime,
      timezone,utc_offset AS utcOffset,attempts,next_attempt_at AS
nextAttemptAt,error_code AS errorCode,created_at AS createdAt
      FROM schedules WHERE document_id=? ORDER BY created_at DESC,id LIMIT 20`,
      id,
    ).all()
    return {
      items: rows.results,
    }
  }

  async schedule(
    id: string,
    input: z.infer<typeof scheduleInputSchema>,
    mutation: Mutation,
  ): Promise<z.infer<typeof scheduleAckSchema>> {
    const replay = await this.replayAs(mutation, scheduleAckSchema)
    if (replay !== null) {
      return replay
    }
    const now = Date.now()
    if (input.runAt <= now || input.runAt > now + 366 * 86400000) {
      throw new Problem(422, 'SCHEDULE_TIME_INVALID')
    }
    if (
      !timeChoices(input.localTime, input.timezone).some(
        choice => choice.runAt === input.runAt && choice.utcOffset === input.utcOffset,
      )
    ) {
      throw new Problem(422, 'SCHEDULE_TIME_INVALID')
    }
    validateDocument((await this.revision(id, input.revisionId)).document, true)
    const row = await this.row(id)
    const response = {
      ...this.ack(row),
      version: input.expectedVersion + 1,
      scheduleId: crypto.randomUUID(),
      state: 'pending' as const,
    }
    await this.commit(
      this.scheduleStatements({ id, input, mutation, now, response }),
      mutation,
    )
    return (await this.replayAs(mutation, scheduleAckSchema)) ?? response
  }

  private scheduleStatements(job: {
    id: string
    input: z.infer<typeof scheduleInputSchema>
    mutation: Mutation
    now: number
    response: z.infer<typeof scheduleAckSchema>
  }): D1PreparedStatement[] {
    const { id, input, mutation, now, response } = job
    return [
      this.guard({
        id,
        version: input.expectedVersion,
        mutation,
        extra: 'AND live_generation=?',
        values: [input.expectedLiveGeneration],
      }),
      this.sql(
        'UPDATE schedules SET state=\'cancelled\',updated_at=? WHERE document_id=? AND state=\'pending\'',
        now,
        id,
      ),
      this.sql(
        `INSERT INTO
schedules(id,document_id,revision_id,expected_live_generation,run_at,local_time,timezone,utc_offset,
        state,next_attempt_at,actor_sub,created_at,updated_at)
VALUES(?,?,?,?,?,?,?,?,'pending',?,?,?,?)`,
        response.scheduleId,
        id,
        input.revisionId,
        input.expectedLiveGeneration,
        input.runAt,
        input.localTime,
        input.timezone,
        input.utcOffset,
        input.runAt,
        mutation.actor,
        now,
        now,
      ),
      this.sql('UPDATE documents SET version=version+1,updated_at=? WHERE id=?', now, id),
      this.journal({
        mutation,
        id,
        operation: 'schedule',
        response,
        now,
      }),
      this.end(mutation),
    ]
  }

  async cancel(
    id: string,
    scheduleId: string,
    version: number,
    mutation: Mutation,
  ): Promise<z.infer<typeof scheduleAckSchema>> {
    const replay = await this.replayAs(mutation, scheduleAckSchema)
    if (replay !== null) {
      return replay
    }
    const row = await this.row(id)
    const now = Date.now()
    const response = {
      ...this.ack(row),
      version: version + 1,
      scheduleId,
      state: 'cancelled' as const,
    }
    await this.commit(
      [
        this.guard({
          id,
          version,
          mutation,
          extra:
            'AND EXISTS(SELECT 1 FROM schedules WHERE id=? AND document_id=documents.id AND state=\'pending\')',
          values: [scheduleId],
        }),
        this.sql(
          'UPDATE schedules SET state=\'cancelled\',updated_at=? WHERE id=?',
          now,
          scheduleId,
        ),
        this.sql('UPDATE documents SET version=version+1,updated_at=? WHERE id=?', now, id),
        this.journal({
          mutation,
          id,
          operation: 'schedule.cancel',
          response,
          now,
        }),
        this.end(mutation),
      ],
      mutation,
    )
    return (await this.replayAs(mutation, scheduleAckSchema)) ?? response
  }

  async runDue(now = Date.now()): Promise<number> {
    const state = await this.sql('SELECT maintenance FROM site_state WHERE id=1').first<{
      maintenance: number
    }>()
    if (state?.maintenance !== 0) {
      return 0
    }
    const jobs = await this.sql(
      `SELECT * FROM schedules WHERE state='pending' AND run_at<=? AND next_attempt_at<=? ORDER
BY run_at,id LIMIT 20`,
      now,
      now,
    ).all<Job>()
    let count = 0
    for (const job of jobs.results) {
      if ((await this.runJob(job, now)) !== null) {
        count++
      }
    }
    return count
  }

  private async runJob(job: Job, now: number): Promise<Acknowledgement | null> {
    try {
      const row = await this.row(job.document_id)
      if (row.live_generation !== job.expected_live_generation) {
        await this.sql(
          `UPDATE schedules SET state='cancelled',error_code='STALE_LIVE',updated_at=? WHERE id=?
AND state='pending' AND (SELECT maintenance=0 FROM site_state WHERE id=1)`,
          now,
          job.id,
        ).run()
        return null
      }
      return await this.publish(
        {
          id: row.id,
          expectedVersion: row.version,
          expectedLiveGeneration: job.expected_live_generation,
          revisionId: job.revision_id,
        },
        {
          key: `schedule:${job.id}`,
          hash: await sha256(job.id),
          actor: job.actor_sub,
        },
        {
          id: job.id,
          now,
        },
      )
    }
    catch (error) {
      const code = error instanceof Problem ? error.code : 'SCHEDULE_TRANSIENT'
      if (code === 'MAINTENANCE') {
        return null
      }
      const terminal
        = error instanceof Problem
          && error.status >= 400
          && error.status < 500
          && code !== 'EDIT_CONFLICT'
      const attempts = job.attempts + 1
      await this.sql(
        `UPDATE schedules SET state=?,attempts=?,error_code=?,next_attempt_at=?,updated_at=?
        WHERE id=? AND state='pending' AND attempts=? AND (SELECT maintenance=0 FROM
site_state WHERE id=1)`,
        terminal || attempts >= 8 ? 'failed' : 'pending',
        attempts,
        code,
        now + Math.min(1800000, 60000 * 2 ** job.attempts),
        now,
        job.id,
        job.attempts,
      ).run()
      return null
    }
  }
}
