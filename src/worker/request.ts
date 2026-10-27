import type { Environment } from '@/server/runtime/environment'
import type { SecurityContext } from '@/worker/security'
import { requireAdmin, trustedOrigin } from '@/server/auth/auth'
import { Problem } from '@/server/http/problem'
import { privatePath } from '@/worker/security'

export async function requestContext(
  request: Request,
  env: Environment,
  nonce: string,
): Promise<{
  url: URL
  request: Request
  security: SecurityContext
}> {
  const url = new URL(request.url)
  const origin = trustedOrigin(env)
  const previews = (env.ALLOWED_PREVIEW_HOSTS ?? '').split(',').filter(Boolean)
  const preview
    = url.origin !== origin.origin && url.protocol === 'https:' && previews.includes(url.host)
  if (url.origin !== origin.origin && !preview) {
    throw new Problem(403, 'HOST_INVALID')
  }
  validatePath(url.pathname)
  const protectedRequest = preview || privatePath(url.pathname)
  if (protectedRequest) {
    await requireAdmin(request.headers, env)
  }
  const headers = new Headers(request.headers)
  headers.set('x-blog-nonce', nonce)
  headers.set('x-blog-request-origin', url.origin)
  headers.set('Content-Security-Policy', `script-src 'self' 'nonce-${nonce}'`)
  return {
    url,
    request: new Request(request, { headers }),
    security: { nonce, privateResponse: protectedRequest, head: request.method === 'HEAD' },
  }
}

function validatePath(path: string): void {
  if (/%|\\|\/\//.test(path) || (path !== '/' && path.endsWith('/'))) {
    throw new Problem(400, 'INVALID_PATH')
  }
}
