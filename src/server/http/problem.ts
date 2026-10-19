import { ContentError } from '@/content/document'

export class Problem extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code)
  }
}
export function problemResponse(error: unknown): Response {
  const status
    = error instanceof Problem || error instanceof ContentError ? error.status : 500
  const code
    = error instanceof Problem || error instanceof ContentError ? error.code : 'INTERNAL_ERROR'
  return Response.json(
    {
      type: `urn:ztd:cms:problem:${code.toLowerCase().replaceAll('_', '-')}`,
      title: code,
      status,
      code,
      messageKey: `errors.${code}`,
      ...(error instanceof ContentError && error.issues.length > 0 ? { issues: error.issues } : {}),
      requestId: crypto.randomUUID(),
    },
    {
      status,
      headers: {
        'Content-Type': 'application/problem+json',
        'Cache-Control': 'no-store',
      },
    },
  )
}
