import { useEffect, useId, useMemo, useState } from 'react'
import { validDiagram } from '@/content/diagram-policy'

export type DiagramStatus = '' | 'diagramLoading' | 'diagramUnsupported'
  | 'diagramUnavailable' | 'diagramTimeout' | 'diagramRenderFailed'
const active = new Set<string>()
const pending = new Map<string, () => void>()
async function template(): Promise<string> {
  const response = await fetch('/render/mermaid', {
    credentials: 'same-origin',
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new Error('Diagram renderer unavailable')
  }
  const source = await response.text()
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source))),
    byte => byte.toString(16).padStart(2, '0'),
  ).join('')
  if (hash !== response.headers.get('x-render-template-sha256')) {
    throw new Error('Diagram renderer integrity mismatch')
  }
  const nonce = document.querySelector<HTMLMetaElement>('meta[name="cms-nonce"]')?.content
  if (nonce === undefined || !/^[A-Z0-9-]+$/i.test(nonce)) {
    throw new Error('Missing diagram nonce')
  }
  return source.replaceAll('CMS_NONCE_PLACEHOLDER', nonce)
}
class DiagramSession {
  frame: HTMLIFrameElement | null = null
  generation = 0
  constructor(readonly channel: string) {}
  attach(element: HTMLIFrameElement | null): void {
    this.frame = element
  }

  close(): void {
    this.generation++
    pending.delete(this.channel)
    this.release()
  }

  release(): void {
    active.delete(this.channel)
    const next = pending.entries().next().value
    if (active.size < 2 && next !== undefined) {
      pending.delete(next[0])
      next[1]()
    }
  }

  show(
    source: string,
    setHTML: (value: string) => void,
    setStatus: (value: DiagramStatus) => void,
  ): void {
    if (!validDiagram(source)) {
      setStatus('diagramUnsupported')
      return
    }
    const current = ++this.generation
    setStatus('diagramLoading')
    const start = (): void => {
      if (this.generation !== current) {
        return
      }
      active.add(this.channel)
      template().then((html) => {
        if (this.generation === current) {
          setHTML(html)
        }
      }).catch(() => {
        if (this.generation === current) {
          this.close()
          setStatus('diagramUnavailable')
        }
      })
    }
    if (active.size >= 2) {
      pending.set(this.channel, start)
    }
    else {
      start()
    }
  }

  send(source: string, mode: 'light' | 'dark'): void {
    this.frame?.contentWindow?.postMessage({
      channel: this.channel,
      source,
      theme: mode === 'dark' ? 'dark' : 'neutral',
    }, '*')
  }
}
type DiagramModel = {
  open: boolean
  status: DiagramStatus
  height: number
  html: string
  frame: (element: HTMLIFrameElement | null) => void
  close: () => void
  show: () => void
  send: () => void
}

export function useDiagram(
  source: string,
  automatic = false,
  mode: 'light' | 'dark' = 'light',
): DiagramModel {
  const [html, setHTML] = useState('')
  const [status, setStatus] = useState<DiagramStatus>('')
  const [height, setHeight] = useState(240)
  const channelId = useId()
  const session = useMemo(() => new DiagramSession(channelId), [channelId])
  useEffect(() => {
    if (automatic && source.trim() !== '') {
      session.show(source, setHTML, setStatus)
    }
  }, [
    automatic,
    session,
    source,
  ])
  useEffect(
    () => () => {
      session.close()
    },
    [session],
  )
  useMessages({ session, html, setHTML, setStatus, setHeight })
  return {
    open: html !== '',
    html,
    status,
    height,
    frame: (element) => {
      session.attach(element)
    },
    close: () => {
      session.close()
      setHTML('')
    },
    show: () => {
      session.show(source, setHTML, setStatus)
    },
    send: () => session.send(source, mode),
  }
}
function message(
  value: unknown,
  channel: string,
): { height?: number, state?: string } | null {
  if (
    value === null
    || typeof value !== 'object'
    || !('channel' in value)
    || value.channel !== channel
  ) {
    return null
  }
  return {
    height: 'height' in value && typeof value.height === 'number' ? value.height : undefined,
    state: 'state' in value && typeof value.state === 'string' ? value.state : undefined,
  }
}
function useMessages(input: {
  session: DiagramSession
  html: string
  setHTML: (value: string) => void
  setStatus: (value: DiagramStatus) => void
  setHeight: (value: number) => void
}): void {
  const { session, html, setHTML, setStatus, setHeight } = input
  useEffect(() => {
    if (html === '') {
      return
    }
    const current = session.frame?.contentWindow
    const timeout = setTimeout(() => {
      session.close()
      setStatus('diagramTimeout')
      setHTML('')
    }, 5000)
    const receive = (event: MessageEvent<unknown>): void => {
      if (event.origin !== 'null' || event.source !== current) {
        return
      }
      const data = message(event.data, session.channel)
      if (data === null) {
        return
      }
      clearTimeout(timeout)
      if (data.state === 'ready') {
        session.release()
        setStatus('')
      }
      if (data.height !== undefined) {
        setHeight(Math.min(2000, Math.max(120, data.height)))
      }
      if (data.state === 'error') {
        session.close()
        setStatus('diagramRenderFailed')
        setHTML('')
      }
    }
    window.addEventListener('message', receive)
    return () => {
      clearTimeout(timeout)
      window.removeEventListener('message', receive)
    }
  }, [
    html,
    session,
    setHTML,
    setStatus,
    setHeight,
  ])
}
