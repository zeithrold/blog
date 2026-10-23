export type MediaCloneProof = {
  page: string
  from: number
  until: number
  resources: {
    url: string
    at: number
    detached: boolean
    sourceConnected: boolean
    sourceError: number | null
    remaining: number
  }[]
}

export function consumeDragCancellation(
  failure: { page: string, url: string, at: number, message: string, method?: string },
  proofs: MediaCloneProof[],
): boolean {
  if (failure.method !== 'GET' || !['cancelled', 'net::ERR_ABORTED'].includes(failure.message)) {
    return false
  }
  if (!/^\/api\/admin\/assets\/[\da-f-]{36}\/content$/u.test(new URL(failure.url).pathname)) {
    return false
  }
  const proof = proofs.find(item => item.page === failure.page && item.from <= failure.at && failure.at <= item.until)
  const resource = proof?.resources.find(item => item.url === failure.url && item.at <= failure.at
    && item.detached && item.sourceConnected && item.sourceError === null && item.remaining > 0)
  if (resource === undefined) {
    return false
  }
  resource.remaining--
  return true
}
