'use client'
import type { ReactNode } from 'react'
import { CircleAlert, LoaderCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button, useFrontendPreferences } from '@/components/ui/ztd-me/client'
import { useDiagram } from '@/features/reader/diagram-controller'
import { useBlogTranslation } from '@/i18n/use-translation'

export function Diagram({ source, description }: { source: string, description: string }): ReactNode {
  const { resolvedMode } = useFrontendPreferences()
  return <DiagramView key={`${source}:${resolvedMode}`} source={source} description={description} mode={resolvedMode} />
}

function DiagramView({ source, description, mode }: {
  source: string
  description: string
  mode: 'light' | 'dark'
}): ReactNode {
  const { t } = useBlogTranslation('site')
  const regionRef = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)
  const model = useDiagram(source, visible, mode)
  const { open, status, show } = model
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisible(true)
        observer.disconnect()
      }
    }, { rootMargin: '160px' })
    if (regionRef.current !== null) {
      observer.observe(regionRef.current)
    }
    return () => observer.disconnect()
  }, [])
  const failed = status !== '' && status !== 'diagramLoading'
  const ready = open && status === ''
  return (
    <figure
      ref={regionRef}
      className="diagram m-0 grid min-w-0 gap-2"
      aria-busy={!ready && !failed}
    >
      <div className="diagram-viewport relative grid min-h-48 min-w-0 items-center">
        <DiagramCanvas model={model} ready={ready} description={description} />
        {!ready && (
          <DiagramPlaceholder
            failed={failed}
            message={t(status === '' ? 'diagramLoading' : status)}
            retryLabel={t('diagramRetry')}
            retry={show}
          />
        )}
      </div>
      {description !== '' && (
        <figcaption
          className="diagram-caption m-0 min-w-0 text-center font-sans text-sm text-muted-foreground wrap-anywhere"
        >
          {description}
        </figcaption>
      )}
    </figure>
  )
}

function DiagramCanvas({ model, ready, description }: {
  model: ReturnType<typeof useDiagram>
  ready: boolean
  description: string
}): ReactNode {
  const { t } = useBlogTranslation('site')
  const { open, frame: attachFrame, html, height, send } = model
  if (!open) {
    return null
  }
  const visibility = ready ? '' : 'invisible absolute inset-0'
  return (
    <iframe
      ref={attachFrame}
      className={`diagram-frame col-start-1 row-start-1 block w-full border-0 ${visibility}`}
      title={description !== '' ? description : t('diagramPreview')}
      sandbox="allow-scripts"
      srcDoc={html}
      height={height}
      onLoad={send}
      aria-hidden={!ready || undefined}
      inert={!ready}
      tabIndex={ready ? 0 : -1}
    />
  )
}

function DiagramPlaceholder({ failed, message, retryLabel, retry }: {
  failed: boolean
  message: string
  retryLabel: string
  retry: () => void
}): ReactNode {
  // role=status already announces politely. Explicit aria-live inside an editor
  // makes modal isolation traverse native blocks, invalidating their node views.
  return (
    <div
      className="diagram-placeholder col-start-1 row-start-1 flex min-h-48 flex-col items-center justify-center
        gap-3 rounded-lg border border-border bg-muted/30 px-6 py-8 text-center font-sans text-help
        text-muted-foreground"
      role="status"
      aria-atomic="true"
    >
      <span className="inline-flex items-center justify-center gap-2">
        {failed
          ? <CircleAlert size={18} className="shrink-0" aria-hidden="true" />
          : <LoaderCircle size={18} className="shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
        <span>{message}</span>
      </span>
      {failed && <Button type="button" variant="outline" onClick={retry}>{retryLabel}</Button>}
    </div>
  )
}
