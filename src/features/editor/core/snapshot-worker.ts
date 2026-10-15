import { ContentError } from '@/content/base'
import { canonicalize } from '@/content/canonical'

type RequestMessage = {
  id: number
  document: unknown
}

globalThis.addEventListener('message', (event: MessageEvent<RequestMessage>) => {
  const { id, document } = event.data
  canonicalize(document)
    .then((result) => {
      globalThis.postMessage({ id, document: result.document })
    })
    .catch((error: unknown) => {
      globalThis.postMessage({
        id,
        error: error instanceof Error ? error.message : 'INVALID_DOCUMENT',
        status: error instanceof ContentError ? error.status : 422,
      })
    })
})
