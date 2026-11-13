import type { NotionBindings } from './bindings'
import { APIErrorCode, isNotionClientError } from '@notionhq/client'
import { z } from 'zod'
import { notionClient } from './api'
import { parseMetadata } from './metadata'

export async function coverRedirect(id: string, bindings: NotionBindings): Promise<Response> {
  if (!z.uuid().safeParse(id).success) {
    return new Response(null, { status: 404 })
  }
  try {
    const item = parseMetadata(
      await notionClient(bindings).pages.retrieve({ page_id: id }),
      bindings.NOTION_DATA_SOURCE_ID,
    )
    if (item === null || item.cover === null) {
      return new Response(null, { status: 404 })
    }
    return new Response(null, {
      status: 302,
      headers: { 'Location': item.cover.url, 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
    })
  }
  catch (error) {
    if (isNotionClientError(error) && error.code === APIErrorCode.ObjectNotFound) {
      return new Response(null, { status: 404 })
    }
    throw error
  }
}
