'use client'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/ztd-me/client'
import { useDiagram } from '@/features/reader/diagram-controller'

const utility1Class = ['diagram p-4 border border-border rounded-[12px] bg-card [&_pre]:mt-3 [&_pre]:mx-0'].join(' ')

export function Diagram({
  source,
  description,
  autoRender = false,
  showSource = true,
}: {
  source: string
  description: string
  autoRender?: boolean
  showSource?: boolean
}): ReactNode {
  return (
    <DiagramView
      key={`${source}:${description}`}
      source={source}
      description={description}
      autoRender={autoRender}
      showSource={showSource}
    />
  )
}

function DiagramView({
  source,
  description,
  autoRender,
  showSource,
}: {
  source: string
  description: string
  autoRender: boolean
  showSource: boolean
}): ReactNode {
  const { open, status, height, html, frame, close, show, send } = useDiagram(source, autoRender)
  return (
    <figure className={[utility1Class, '[&_pre]:mb-0'].join(' ')}>
      {description !== '' && <figcaption>{description}</figcaption>}
      {open
        ? (
            <>
              <Button variant="outline" className="my-3" type="button" onClick={close}>
                Close diagram
              </Button>
              <iframe
                ref={frame}
                title={description !== '' ? description : 'Diagram preview'}
                sandbox="allow-scripts"
                srcDoc={html}
                height={height}
                onLoad={send}
              />
            </>
          )
        : (
            <Button variant="outline" className="my-3" type="button" onClick={show}>
              Render diagram
            </Button>
          )}
      {status !== '' && <p role="status">{status}</p>}
      {showSource && (
        <pre>
          <code>{source}</code>
        </pre>
      )}
    </figure>
  )
}
