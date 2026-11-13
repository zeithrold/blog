import { NotionContentError } from '@/server/notion/api'

export class Problem extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code)
  }
}
export function problemResponse(error: unknown): Response {
  let status = 500
  let code = 'INTERNAL_ERROR'
  if (error instanceof Problem) {
    status = error.status
    code = error.code
  }
  else if (error instanceof NotionContentError) {
    status = 502
    code = 'NOTION_CONTENT_INVALID'
  }
  return Response.json(
    {
      type: `urn:ztd:blog:problem:${code.toLowerCase().replaceAll('_', '-')}`,
      title: code,
      status,
      code,
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
