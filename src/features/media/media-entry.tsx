'use client'
import type { ReactNode } from 'react'
import type { GallerySession } from '@/features/media/gallery-session'
import { useEffect, useState } from 'react'
import { openGallery } from '@/features/media/gallery-session'
import { MediaManager } from '@/features/media/media'
import { adminError } from '@/shared/admin/errors'
import { AdminFeedback } from '@/shared/admin/feedback'

export function MediaEntry({ owner }: { owner: string }): ReactNode {
  return <VerifiedGallery key={owner} owner={owner} />
}

function VerifiedGallery({ owner }: { owner: string }): ReactNode {
  const [attempt, setAttempt] = useState(0)
  const [session, setSession] = useState<GallerySession | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    openGallery(owner, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setSession(value)
        }
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) {
          setError(adminError(failure, 'Unable to load media.'))
        }
      })
    return () => controller.abort()
  }, [owner, attempt])
  return session === null
    ? (
        <section className="mx-auto max-w-290 p-6" aria-busy={error === ''}>
          <AdminFeedback
            loading={error === ''}
            error={error}
            retry={async () => {
              setError('')
              setAttempt(value => value + 1)
              return await Promise.resolve()
            }}
          />
        </section>
      )
    : (
        <MediaManager
          session={session}
          retry={async () => {
            setSession(null)
            setError('')
            setAttempt(value => value + 1)
            return await Promise.resolve()
          }}
        />
      )
}
