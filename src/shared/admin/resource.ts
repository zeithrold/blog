'use client'
import type { z } from 'zod'
import { useCallback, useEffect, useRef, useState } from 'react'
import { get } from '@/shared/admin/api-client'

export function useAdminResource<T>(
  path: string,
  schema: z.ZodType<T>,
): {
  data: T | null
  loading: boolean
  error: string
  updatedAt: number | null
  refresh: () => Promise<T | null>
} {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const generationRef = useRef(0)
  const refresh = useCallback(async (): Promise<T | null> => {
    const request = ++generationRef.current
    setLoading(true)
    setError('')
    try {
      const result = await get(path, schema)
      if (request === generationRef.current) {
        setData(result)
        setUpdatedAt(Date.now())
        return result
      }
    }
    catch {
      if (request === generationRef.current) {
        setError('Unable to load data. Please retry.')
      }
    }
    finally {
      if (request === generationRef.current) {
        setLoading(false)
      }
    }
    return null
  }, [path, schema])
  useEffect(() => {
    const requests = generationRef
    refresh().catch(() => {})
    return () => {
      requests.current++
    }
  }, [refresh])
  return { data, loading, error, updatedAt, refresh }
}
