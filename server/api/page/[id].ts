import { isFullPage } from '@notionhq/client'
import { createNotionClient } from '~~/server/lib'

export default defineCachedEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (typeof id !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'id must be a string',
    })
  }
  const client = createNotionClient(event)
  const response = await client.getPage(id)
  response.notion_user
  if (!isFullPage(response)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'page is not full',
    })
  }
  return response
}, {
  maxAge: 60 * 5,
})
