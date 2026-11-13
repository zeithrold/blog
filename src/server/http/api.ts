import type { Environment } from '@/server/runtime/environment'
import { handleWebhook } from '@/server/notion/webhook'
import { Problem } from './problem'

export async function api(request: Request, env: Environment): Promise<Response> {
  const path = new URL(request.url).pathname
  if (path === '/api/health' && ['GET', 'HEAD'].includes(request.method)) {
    return Response.json({ ok: true, build: env.BUILD_SHA ?? 'local', reader: 'notion' })
  }
  if (path === '/api/notion/webhook') {
    return await handleWebhook(request, env)
  }
  throw new Problem(404, 'NOT_FOUND')
}
