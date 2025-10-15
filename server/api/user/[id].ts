import type { UserObjectResponse } from '@notionhq/client'
import { isFullUser } from '@notionhq/client'
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
  const response = await notionFetch<UserObjectResponse>(`/users/${id}`)
  if (!isFullUser(response)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'page is not full',
    })
  }
  return response
}, {
  maxAge: 60 * 5,
  swr: false,
})
