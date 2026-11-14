import type { Environment } from '@/server/runtime/environment'
import handler from 'vinext/server/app-router-entry'
import { api } from '@/server/http/api'
import { coverRedirect } from '@/server/notion/cover'
import { markdownResponse } from '@/server/notion/markdown'
import { feeds } from '@/server/reader/feeds'

export async function dispatch(
  request: Request,
  env: Environment,
): Promise<{ readonly response: Response }> {
  const path = new URL(request.url).pathname
  if (path.startsWith('/api/')) {
    return { response: await api(request, env) }
  }
  const markdown = await markdownResponse(request, env)
  if (markdown !== null) {
    return { response: markdown }
  }
  if (['GET', 'HEAD'].includes(request.method)) {
    const cover = /^\/notion-media\/([^/]+)\/cover$/.exec(path)
    if (cover?.[1] !== undefined) {
      return { response: await coverRedirect(cover[1], env) }
    }
    const feed = await feeds(path, env)
    if (feed !== null) {
      return { response: feed }
    }
    if (/^\/(?:_next\/static|static|favicon\.ico|licenses)(?:\/|$)/.test(path)) {
      const asset = await env.ASSETS.fetch(request)
      if (asset.status !== 404) {
        return { response: asset }
      }
      await asset.body?.cancel()
    }
  }
  return { response: await handler.fetch(request, env) }
}
