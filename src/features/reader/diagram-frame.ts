import mermaid from 'mermaid'
import { validDiagram } from '@/content/diagram-policy'

const nonce = document.querySelector<HTMLScriptElement>('script[nonce]')?.nonce ?? ''

function initialize(theme: 'dark' | 'neutral'): void {
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    maxTextSize: 16384,
    maxEdges: 200,
    htmlLabels: false,
    theme,
    flowchart: {
      htmlLabels: false,
    },
  })
}
const parentOrigin = document.querySelector<HTMLMetaElement>(
  'meta[name="parent-origin"]',
)?.content
let running = false
type DiagramRequest = {
  channel: string
  source: string
  theme: 'dark' | 'neutral'
}

function validTheme(value: unknown): value is 'dark' | 'neutral' {
  return value === 'dark' || value === 'neutral'
}

function request(value: unknown): DiagramRequest | null {
  if (
    value === null
    || typeof value !== 'object'
    || !('channel' in value)
    || !('source' in value)
  ) {
    return null
  }
  if (
    typeof value.channel !== 'string'
    || typeof value.source !== 'string'
    || !validDiagram(value.source)
    || !('theme' in value)
    || !validTheme(value.theme)
  ) {
    return null
  }
  return {
    channel: value.channel,
    source: value.source,
    theme: value.theme,
  }
}
async function render(event: MessageEvent<unknown>): Promise<void> {
  if (event.source !== window.parent || event.origin !== parentOrigin || running) {
    return
  }
  const data = request(event.data)
  if (data === null) {
    return
  }
  running = true
  try {
    initialize(data.theme)
    document.documentElement.style.colorScheme = data.theme === 'dark' ? 'dark' : 'light'
    const { svg } = await mermaid.render('cms-generated-diagram', data.source)
    const container = document.getElementById('diagram')
    if (container !== null) {
      const parsed = new DOMParser().parseFromString(svg, 'text/html')
      const rendered = parsed.querySelector('svg')
      if (rendered === null) {
        throw new Error('Invalid rendered diagram')
      }
      const fragment = document.importNode(rendered, true)
      for (const style of fragment.querySelectorAll('style')) {
        style.setAttribute('nonce', nonce)
      }
      container.replaceChildren(fragment)
    }
    window.parent.postMessage(
      {
        channel: data.channel,
        height: Math.ceil(document.body.scrollHeight),
        state: 'ready',
      },
      event.origin,
    )
  }
  catch {
    window.parent.postMessage(
      {
        channel: data.channel,
        state: 'error',
      },
      event.origin,
    )
  }
  finally {
    running = false
  }
}
window.addEventListener('message', (event: MessageEvent<unknown>) => {
  render(event).catch(() => undefined)
})
