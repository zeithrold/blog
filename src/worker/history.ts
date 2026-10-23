import { historyBootstrap } from '@/shared/admin/history-bootstrap'

export function earlyHistory(response: Response, nonce: string): Response {
  if (response.body === null || !(response.headers.get('content-type') ?? '').startsWith('text/html')) {
    return response
  }
  const headers = new Headers(response.headers)
  headers.delete('Content-Length')
  const html = new Response(response.body, { status: response.status, statusText: response.statusText, headers })
  return new HTMLRewriter().on('head', {
    element(element) {
      // The router must capture the stamped methods before any client module runs.
      element.prepend(`<script nonce="${nonce}">${historyBootstrap}</script>`, { html: true })
    },
  }).transform(html)
}
