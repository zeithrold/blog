import type { PageObjectResponse } from '@notionhq/client'
import { isFullPage } from '@notionhq/client'
import { createNotionFetch } from '~~/server/lib'

export default defineCachedEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (typeof id !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'id must be a string',
    })
  }
  const notionFetch = await createNotionFetch(event)
  const response = await notionFetch<PageObjectResponse>(`/pages/${id}`)
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
