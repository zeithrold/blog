import type { ReferenceMetadata } from '@/content/reference-metadata'
import { useEffect, useRef, useState } from 'react'
import { normalizeDoi, referenceMetadataSchema } from '@/content/reference-metadata'
import { APIError, read } from '@/features/editor/services/api-client'
import { useBlogTranslation } from '@/i18n/use-translation'

type Lookup = { state: 'idle' | 'loading' | 'success' | 'error', message: string }

export function useDoiLookup(input: string, open: boolean, apply: (metadata: ReferenceMetadata) => void): {
  lookup: Lookup
  reset: () => void
  retrieve: () => Promise<void>
} {
  const { t } = useBlogTranslation('editor')
  const [lookup, setLookup] = useState<Lookup>({ state: 'idle', message: '' })
  const controllerRef = useRef<AbortController | null>(null)
  useEffect(() => {
    if (!open) {
      controllerRef.current?.abort()
    }
    return () => controllerRef.current?.abort()
  }, [open])
  const reset = (): void => {
    controllerRef.current?.abort()
    setLookup({ state: 'idle', message: '' })
  }
  const retrieve = async (): Promise<void> => {
    const doi = normalizeDoi(input)
    if (doi === null) {
      setLookup({ state: 'error', message: t('referenceDoiInvalid') })
      return
    }
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setLookup({ state: 'loading', message: '' })
    try {
      const response = await fetch(`/api/admin/reference-metadata?doi=${encodeURIComponent(doi)}`, {
        cache: 'no-store',
        signal: controller.signal,
      })
      const metadata = await read(response, referenceMetadataSchema)
      if (!controller.signal.aborted) {
        apply(metadata)
        setLookup({ state: 'success', message: t(lookupSuccess(metadata)) })
      }
    }
    catch (error) {
      if (!controller.signal.aborted) {
        setLookup({ state: 'error', message: t(lookupFailure(error)) })
      }
    }
  }
  return { lookup, reset, retrieve }
}

function lookupSuccess(metadata: ReferenceMetadata): 'referenceLookupPartial' | 'referenceLookupFilled' {
  return metadata.title === '' || metadata.authors.length === 0 || metadata.year === null
    ? 'referenceLookupPartial'
    : 'referenceLookupFilled'
}
function lookupFailure(error: unknown):
'referenceDoiInvalid' | 'referenceLookupNotFound' | 'referenceLookupUnavailable' {
  if (error instanceof APIError && error.code === 'DOI_INVALID') {
    return 'referenceDoiInvalid'
  }
  return error instanceof APIError && error.code === 'DOI_NOT_FOUND'
    ? 'referenceLookupNotFound'
    : 'referenceLookupUnavailable'
}
