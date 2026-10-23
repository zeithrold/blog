import type { Environment } from '@/server/runtime/environment'
import { sha256 } from '@/content/canonical'
import frameURL from '@/features/reader/diagram-frame.ts?worker&url'
import { diagramPrelude } from '@/server/reader/diagram-prelude'

export async function diagramFrame(env: Environment, origin: string): Promise<Response> {
  const asset = await env.ASSETS.fetch(new Request(new URL(frameURL, origin)))
  if (!asset.ok) {
    return new Response('Diagram renderer unavailable', {
      status: 503,
    })
  }
  const code = (await asset.text()).replace(/<\/script/gi, '<\\/script')
  const csp = [
    'default-src \'none\'',
    'script-src \'nonce-CMS_NONCE_PLACEHOLDER\'',
    'style-src \'nonce-CMS_NONCE_PLACEHOLDER\'',
    'style-src-attr \'unsafe-inline\'',
    'connect-src \'none\'',
    'img-src \'none\'',
    'font-src \'none\'',
    'frame-src \'none\'',
    'form-action \'none\'',
    'base-uri \'none\'',
  ].join('; ')
  const template = `<!doctype html><html><head><meta charset="utf-8"><meta name="parent-origin" content="${origin}">
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <style nonce="CMS_NONCE_PLACEHOLDER">body{margin:0;padding:8px}
    #diagram{display:flex;justify-content:center}svg{max-width:100%;height:auto}</style>
    </head><body><div id="diagram"></div><script nonce="CMS_NONCE_PLACEHOLDER">${diagramPrelude}</script>
    <script nonce="CMS_NONCE_PLACEHOLDER">${code}</script></body></html>`
  return new Response(template, {
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
      'X-Render-Template-SHA256': await sha256(template),
      'Cache-Control': 'no-store',
    },
  })
}
