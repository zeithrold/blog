import type { Environment } from '@/server/runtime/environment'
import handler from 'vinext/server/app-router-entry'
import { UUID } from '@/content/document'
import { api } from '@/server/http/api'
import { AssetContent } from '@/server/media/asset-content'
import { diagramFrame } from '@/server/reader/diagram-frame'
import { feeds } from '@/server/reader/feeds'

type Result = {
  response: Response
  policy?: string
}

export async function dispatch(request: Request, env: Environment): Promise<Result> {
  const url = new URL(request.url)
  if (url.pathname.startsWith('/api/')) {
    const response = await api(request, env)
    return { response, policy: filePolicy(response) }
  }
  if (['GET', 'HEAD'].includes(request.method)) {
    const response = await readRoute(request, env)
    if (response !== null) {
      return response
    }
  }
  return { response: await handler.fetch(request, env) }
}
function filePolicy(response: Response): string | undefined {
  return response.headers.get('content-disposition')?.startsWith('attachment') === true
    ? (response.headers.get('content-security-policy') ?? undefined)
    : undefined
}
async function readRoute(request: Request, env: Environment): Promise<Result | null> {
  const url = new URL(request.url)
  if (url.pathname === '/render/mermaid' || url.pathname === '/diagram-frame') {
    const response = await diagramFrame(env, url.origin)
    return { response, policy: response.headers.get('content-security-policy') ?? undefined }
  }
  const feed = await feeds(url.pathname, env)
  if (feed !== null) {
    return { response: feed }
  }
  return await readAssets(request, env)
}
async function readAssets(request: Request, env: Environment): Promise<Result | null> {
  const url = new URL(request.url)
  const media = /^\/assets\/([^/]+)$/.exec(url.pathname)
  if (media?.[1] !== undefined && UUID.safeParse(media[1]).success) {
    const response = await new AssetContent(env.DB).serve(request, media[1], env.MEDIA)
    return { response, policy: filePolicy(response) }
  }
  if (!/^\/(?:_next\/static|static|favicon\.ico|licenses)(?:\/|$)/.test(url.pathname)) {
    return null
  }
  const asset = await env.ASSETS.fetch(request)
  if (asset.status !== 404) {
    return { response: asset }
  }
  await asset.body?.cancel()
  return null
}
