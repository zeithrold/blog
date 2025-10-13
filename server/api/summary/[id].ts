import type { BlockObjectResponse, ListBlockChildrenResponse } from '@notionhq/client'
import { isFullBlock } from '@notionhq/client'
import { createNotionFetch } from '~~/server/lib'

/**
 * Get the full text of the blocks
 */
function getFullText(blocks: BlockObjectResponse[]) {
  let result = ''
  for (const blockItem of blocks) {
    if (blockItem.type === 'paragraph') {
      result += blockItem.paragraph.rich_text.map(text => text.plain_text).join('')
    }
    if (blockItem.type === 'divider') {
      break
    }
  }
  return result
}

export default defineCachedEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (typeof id !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'id must be a string',
    })
  }
  const notionFetch = await createNotionFetch(event)
  const response = await notionFetch<ListBlockChildrenResponse>(`/blocks/${id}/children`)
  const fullText = getFullText(response.results.filter(isFullBlock))
  // max text of 10000 characters
  const summary = fullText.slice(0, 10000)
  return {
    summary,
  }
}, {
  maxAge: 60 * 5,
})
