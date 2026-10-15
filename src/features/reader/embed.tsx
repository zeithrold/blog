'use client'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { Button } from '@/components/ui/ztd-me/client'

export function VideoEmbed({
  videoId,
  title,
}: {
  videoId: string
  title: string
}): ReactNode {
  const [consent, setConsent] = useState(false)
  if (!/^[\w-]{11}$/.test(videoId)) {
    return <p>YouTube video has not been selected.</p>
  }
  return (
    <figure>
      <figcaption>{title}</figcaption>
      {consent
        ? (
            <>
              <Button variant="outline" className="my-3" type="button" onClick={() => setConsent(false)}>
                Unload video
              </Button>
              <iframe
                title={title !== '' ? title : 'YouTube video'}
                src={`https://www.youtube-nocookie.com/embed/${videoId}`}
                sandbox="allow-scripts allow-presentation"
                allow="fullscreen; encrypted-media"
                referrerPolicy="no-referrer"
                loading="lazy"
              />
            </>
          )
        : (
            <Button variant="outline" className="my-3" type="button" onClick={() => setConsent(true)}>
              Load video from YouTube
            </Button>
          )}
    </figure>
  )
}
