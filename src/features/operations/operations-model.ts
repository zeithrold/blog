import type { z } from 'zod'
import { useMemo, useRef, useState } from 'react'
import { operationsSchema, resumeSchema } from '@/contracts/operations'
import { Client } from '@/shared/admin/api-client'
import { useAdminResource } from '@/shared/admin/resource'

type Model = {
  data: z.infer<typeof operationsSchema> | null
  loading: boolean
  busy: boolean
  error: string
  confirm: boolean
  updatedAt: number | null
  setConfirm: (value: boolean) => void
  refresh: () => Promise<void>
  /** Resolves `true` only when the server confirmed writes resumed. */
  resume: () => Promise<boolean>
}

export function useOperations(csrfToken: string): Model {
  const client = useMemo(() => new Client(csrfToken), [csrfToken])
  const resource = useAdminResource('/api/admin/operations', operationsSchema)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const flightRef = useRef(false)
  const refresh = async (): Promise<void> => {
    setError('')
    await resource.refresh()
  }
  const resume = async (): Promise<boolean> => {
    const data = resource.data
    if (
      data === null
      || flightRef.current
      || data.maintenance !== 1
      || data.maintenanceOwner !== null
    ) {
      return false
    }
    flightRef.current = true
    setBusy(true)
    try {
      await client.mutate({
        path: '/api/admin/operations/resume',
        method: 'POST',
        body: { expectedGeneration: data.publicGeneration },
        schema: resumeSchema,
      })
      await refresh()
      return true
    }
    catch {
      setError('Could not resume writes. Refresh and review the current maintenance state.')
      return false
    }
    finally {
      flightRef.current = false
      setBusy(false)
    }
  }
  return {
    ...resource,
    error: error !== '' ? error : resource.error,
    busy,
    confirm,
    updatedAt: resource.updatedAt,
    setConfirm,
    refresh,
    resume,
  }
}
