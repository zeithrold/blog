'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

const REFRESH_LEAD = 60_000
const MAX_DELAY = 2_147_483_647

/** One refresh per expiry, including when a suspended tab resumes. */
export function MediaExpiryRefresh({ expiresAt }: { readonly expiresAt: number | null }): null {
  const router = useRouter()
  const refreshedRef = useRef<number | null>(null)
  useEffect(() => {
    if (expiresAt === null || refreshedRef.current === expiresAt) {
      return
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    const refresh = (): void => {
      if (document.visibilityState === 'hidden' || refreshedRef.current === expiresAt) {
        return
      }
      refreshedRef.current = expiresAt
      clearTimeout(timer)
      router.refresh()
    }
    const schedule = (): void => {
      clearTimeout(timer)
      const delay = expiresAt - REFRESH_LEAD - Date.now()
      if (delay <= 0) {
        refresh()
      }
      else {
        // A long-lived URL may exceed the browser's maximum timer delay.
        timer = setTimeout(schedule, Math.min(delay, MAX_DELAY))
      }
    }
    const resume = (): void => {
      if (document.visibilityState !== 'hidden') {
        schedule()
      }
    }
    schedule()
    document.addEventListener('visibilitychange', resume)
    window.addEventListener('pageshow', resume)
    window.addEventListener('focus', resume)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', resume)
      window.removeEventListener('pageshow', resume)
      window.removeEventListener('focus', resume)
    }
  }, [expiresAt, router])
  return null
}
