import { EDITOR_STYLE_HASHES } from '@/server/security/editor-csp'
import { SONNER_STYLE_HASH } from '@/server/security/toast-csp'

export type SecurityContext = {
  nonce: string
  privateResponse: boolean
  head: boolean
}

export function privatePath(path: string): boolean {
  return /^\/(?:admin|api\/admin)(?:\/|$)/.test(path)
}
export function security(
  response: Response,
  context: SecurityContext,
  policy?: string,
): Response {
  const headers = new Headers(response.headers)
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  const directives = [
    'default-src \'self\'',
    `script-src 'self' 'nonce-${context.nonce}'`,
    `style-src 'self' 'nonce-${context.nonce}' ${EDITOR_STYLE_HASHES} ${SONNER_STYLE_HASH} https://fonts.googleapis.com`,
    'style-src-attr \'unsafe-inline\'',
    'font-src \'self\' https://fonts.gstatic.com',
    'img-src \'self\' data:',
    'connect-src \'self\'',
    'worker-src \'self\'',
    'frame-src \'self\' https://www.youtube-nocookie.com',
    'object-src \'none\'',
    'base-uri \'none\'',
    'frame-ancestors \'none\'',
    'form-action \'self\'',
  ]
  headers.set('Content-Security-Policy', policy ?? directives.join('; '))
  headers.set('Cache-Control', 'no-store')
  if (context.privateResponse) {
    headers.set('X-Robots-Tag', 'noindex, nofollow')
  }
  if (context.head) {
    response.body?.cancel().catch(() => undefined)
  }
  return new Response(context.head ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
