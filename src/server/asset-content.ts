import type { R2Bucket } from '@cloudflare/workers-types/index.ts'
import type { AssetRow } from '@/server/assets'
import { AssetRepository } from '@/server/assets'
import { Problem } from '@/server/problem'
import { r2Body } from '@/server/r2-body'

function range(
  value: string | null,
  size: number,
):
  | {
    offset: number
    length: number
  }
  | undefined {
  if (value === null) {
    return undefined
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(value)
  if (match === null || (match[1] === '' && match[2] === '')) {
    throw new Problem(416, 'RANGE_INVALID')
  }
  const suffix = match[1] === ''
  const start = suffix ? Math.max(0, size - Number(match[2])) : Number(match[1])
  const end = suffix || match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1)
  validateRange(start, end, size)
  return {
    offset: start,
    length: end - start + 1,
  }
}
function validateRange(start: number, end: number, size: number): void {
  if (
    !Number.isSafeInteger(start)
    || !Number.isSafeInteger(end)
    || start < 0
    || start >= size
    || end < start
  ) {
    throw new Problem(416, 'RANGE_INVALID')
  }
}
function headers(row: AssetRow): Headers {
  const result = new Headers({
    'Content-Type': row.type,
    'ETag': `"${row.sha256}"`,
    'Cache-Control': 'no-store',
    'Accept-Ranges': 'bytes',
    'X-Content-Type-Options': 'nosniff',
    'Content-Disposition': disposition(row),
  })
  if (row.role === 'file') {
    result.set(
      'Content-Security-Policy',
      'sandbox; default-src \'none\'; frame-ancestors \'none\'',
    )
  }
  return result
}
function selectedRange(
  request: Request,
  responseHeaders: Headers,
  size: number,
): ReturnType<typeof range> {
  const ifRange = request.headers.get('if-range')
  const selected = range(
    ifRange === null || ifRange === responseHeaders.get('etag')
      ? request.headers.get('range')
      : null,
    size,
  )
  if (selected !== undefined) {
    responseHeaders.set(
      'Content-Range',
      `bytes ${selected.offset}-${selected.offset + selected.length - 1}/${size}`,
    )
  }
  responseHeaders.set('Content-Length', String(selected?.length ?? size))
  return selected
}
async function content(request: Request, row: AssetRow, bucket: R2Bucket): Promise<Response> {
  const object = await bucket.head(row.object_key)
  if (
    object === null
    || object.size !== row.declared_bytes
    || object.customMetadata?.sha256 !== row.sha256
  ) {
    throw new Problem(404, 'ASSET_NOT_FOUND')
  }
  const responseHeaders = headers(row)
  if (request.headers.get('if-none-match') === responseHeaders.get('etag')) {
    return new Response(null, {
      status: 304,
      headers: responseHeaders,
    })
  }
  const selected = selectedRange(request, responseHeaders, object.size)
  const status = selected === undefined ? 200 : 206
  if (request.method === 'HEAD') {
    return new Response(null, { status, headers: responseHeaders })
  }
  const stored = await bucket.get(
    row.object_key,
    selected === undefined
      ? {}
      : {
          range: selected,
        },
  )
  if (stored === null) {
    throw new Problem(404, 'ASSET_NOT_FOUND')
  }
  return new Response(r2Body(stored), {
    status,
    headers: responseHeaders,
  })
}
export class AssetContent extends AssetRepository {
  async serve(
    request: Request,
    id: string,
    bucket: R2Bucket,
    privatePreview = false,
  ): Promise<Response> {
    if (!['GET', 'HEAD'].includes(request.method)) {
      throw new Problem(405, 'METHOD_NOT_ALLOWED')
    }
    const row = privatePreview
      ? await this.asset(id)
      : await this.sql(
          `SELECT a.* FROM assets a WHERE a.id=? AND a.state='ready'
      AND EXISTS(SELECT 1 FROM revision_assets ra JOIN documents d ON
d.live_revision_id=ra.revision_id
      JOIN published_documents p ON p.document_id=d.id AND
p.revision_id=d.live_revision_id
      WHERE ra.asset_id=a.id AND d.deleted_at IS NULL)`,
          id,
        ).first<AssetRow>()
    if (row === null || row.state !== 'ready') {
      throw new Problem(404, 'ASSET_NOT_FOUND')
    }
    try {
      return await content(request, row, bucket)
    }
    catch (error) {
      if (!(error instanceof Problem) || error.status !== 416) {
        throw error
      }
      return new Response(null, {
        status: 416,
        headers: {
          'Content-Range': `bytes */${row.declared_bytes}`,
          'Cache-Control': 'no-store',
        },
      })
    }
  }
}

function disposition(row: AssetRow): string {
  return `${row.role === 'file' ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(row.filename)}`
}
