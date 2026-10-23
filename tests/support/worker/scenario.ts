import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Runtime } from './runtime'
import { ScheduleRepository } from '@/server/publication/schedules'

// Named states only. This gateway module is never imported into the production Worker.
export async function scenario(app: Runtime, incoming: IncomingMessage, outgoing: ServerResponse): Promise<void> {
  if (!authorized(app, incoming)) {
    outgoing.writeHead(403).end()
    return
  }
  let body = ''
  for await (const chunk of incoming) {
    body += String(chunk)
    if (body.length > 128) {
      outgoing.writeHead(413).end()
      return
    }
  }
  if (body === 'maintenance') {
    await app.db.prepare('UPDATE site_state SET maintenance=1,maintenance_owner=NULL,maintenance_since=? WHERE id=1')
      .bind(Date.now())
      .run()
    outgoing.writeHead(204).end()
  }
  else if (body === 'run-due') {
    const completed = await runDue(app)
    outgoing.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ completed }))
  }
  else {
    outgoing.writeHead(400).end()
  }
}

function authorized(app: Runtime, incoming: IncomingMessage): boolean {
  return incoming.method === 'POST' && incoming.headers.host === new URL(app.origin).host
    && incoming.headers['sec-fetch-site'] !== 'cross-site'
    && (incoming.headers.cookie ?? '').split('; ').includes('fixture=browser-test')
}

async function runDue(app: Runtime): Promise<number> {
  const row = await app.db.prepare('SELECT MAX(run_at) AS due FROM schedules WHERE state=\'pending\'')
    .first<{ due: number | null }>()
  return row?.due === null || row?.due === undefined ? 0 : await new ScheduleRepository(app.db).runDue(row.due + 1)
}
