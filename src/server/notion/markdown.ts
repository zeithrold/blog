import type { NotionBindings } from './bindings'
import { z } from 'zod'
import { slugSchema } from '@/contracts/notion'
import { notionClient, NotionContentError } from './api'
import { readPageMetadata } from './page'

const markdownSchema = z.object({
  object: z.literal('page_markdown'),
  id: z.uuid(),
  markdown: z.string(),
  truncated: z.literal(false),
  unknown_block_ids: z.array(z.string()).length(0),
})

export async function markdownResponse(request: Request, bindings: NotionBindings): Promise<Response | null> {
  const slug = /^\/posts\/([^/]+)\.md$/.exec(new URL(request.url).pathname)?.[1]
  if (slug === undefined) {
    return null
  }
  if (!['GET', 'HEAD'].includes(request.method)) {
    return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } })
  }
  const parsed = slugSchema.safeParse(slug)
  if (!parsed.success) {
    return new Response(null, { status: 404 })
  }
  const selected = await readPageMetadata(bindings, `/posts/${parsed.data}`)
  if (selected === null) {
    return new Response(null, { status: 404 })
  }
  const result = markdownSchema.safeParse(await notionClient(bindings).pages.retrieveMarkdown({
    page_id: selected.item.id,
    markdown_version: 'v1',
  }))
  if (!result.success || result.data.id !== selected.item.id) {
    throw new NotionContentError('Incomplete Markdown response')
  }
  const title = selected.item.title.replace(/[\\`*_[\]<>]/g, '\\$&').replace(/[\r\n]+/g, ' ')
  return new Response(`# ${title}\n\n${result.data.markdown}`, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `inline; filename="${parsed.data}.md"`,
      'Cache-Control': 'no-store',
      'Link': `<${selected.item.path}>; rel="canonical"`,
    },
  })
}
