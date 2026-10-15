import type { Environment } from '@/server/environment'
import { sha256, stableJSON } from '@/content/canonical'
import { UUID } from '@/content/document'
import { parse, respond } from '@/server/api-contracts'
import { readDocuments, writeDocuments } from '@/server/api-documents'
import { readServices, writeServices } from '@/server/api-services'
import { AssetUpload } from '@/server/asset-upload'
import { requireMutation, requireOwner, sessionToken } from '@/server/auth'
import { readJSON } from '@/server/json'
import { Problem, problemResponse } from '@/server/problem'
import { ScheduleRepository } from '@/server/schedules'

async function admin(request: Request, env: Environment): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname
  const owner = await requireOwner(request.headers, env)
  const repository = new ScheduleRepository(env.DB)
  if (path === '/api/admin/session' && request.method === 'GET') {
    return respond({
      csrfToken: await sessionToken(owner, url.origin, env),
      ownerSub: owner,
    })
  }
  if (['GET', 'HEAD'].includes(request.method)) {
    return path.startsWith('/api/admin/documents')
      ? await readDocuments(url, repository)
      : await readServices(request, env)
  }
  if (![
    'POST',
    'PUT',
    'DELETE',
  ].includes(request.method)) {
    throw new Problem(405, 'METHOD_NOT_ALLOWED')
  }
  await requireMutation(request, owner, env)
  const upload = /^\/api\/admin\/assets\/([^/]+)\/content$/.exec(path)
  if (upload?.[1] !== undefined && request.method === 'PUT') {
    return respond(
      await new AssetUpload(env.DB, env.MEDIA).upload(request, parse(UUID, upload[1]), owner),
    )
  }
  const key = parse(UUID, request.headers.get('idempotency-key'))
  const body = await readJSON(request)
  const mutation = {
    key,
    hash: await sha256(
      stableJSON({
        method: request.method,
        path,
        body,
        actor: owner,
      }),
    ),
    actor: owner,
  }
  return path.startsWith('/api/admin/documents')
    ? await writeDocuments(repository, { url, method: request.method, body, mutation })
    : await writeServices(request, env, body, mutation)
}
export async function api(request: Request, env: Environment): Promise<Response> {
  try {
    const url = new URL(request.url)
    if (url.pathname === '/api/health' && ['GET', 'HEAD'].includes(request.method)) {
      return respond({
        ok: true,
        build: env.BUILD_SHA ?? 'local',
        reader: 1,
      })
    }
    if (url.pathname === '/api/search' && request.method === 'GET') {
      return respond(
        await new ScheduleRepository(env.DB).search(
          url.searchParams.get('q') ?? '',
          Number(url.searchParams.get('offset') ?? 0),
        ),
      )
    }
    if (!url.pathname.startsWith('/api/admin/')) {
      throw new Problem(404, 'NOT_FOUND')
    }
    return await admin(request, env)
  }
  catch (error) {
    return problemResponse(error)
  }
}
