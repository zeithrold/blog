import type { z } from 'zod'
import { useCallback, useRef, useState } from 'react'
import { assetListSchema } from '@/contracts/media'
import { get } from '@/shared/admin/api-client'

type Asset = z.infer<typeof assetListSchema>['items'][number]
export function useMediaLibrary(): {
  items: Asset[]
  cursor: string | null
  error: string
  busy: boolean
  load: (more?: boolean) => Promise<void>
} {
  const [items, setItems] = useState<Asset[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const cursorRef = useRef<string | null>(null)
  const load = useCallback(async (more = false): Promise<void> => {
    if (busyRef.current) {
      return
    }
    setBusy(true)
    busyRef.current = true
    setError('')
    try {
      const query = more && cursorRef.current !== null ? `?cursor=${encodeURIComponent(cursorRef.current)}` : ''
      const response = await get(
        `/api/admin/assets${query}`,
        assetListSchema,
      )
      setItems(old => (more
        ? [
            ...old,
            ...response.items,
          ]
        : response.items))
      setCursor(response.nextCursor)
      cursorRef.current = response.nextCursor
    }
    catch {
      setError('Unable to load media.')
    }
    finally {
      setBusy(false)
      busyRef.current = false
    }
  }, [])
  return { items, cursor, busy, error, load }
}
