import type { BlockChildrenResponse, BlockResponse } from '#shared/notion'
import type { BlockObjectResponse, ListBlockChildrenResponse } from '@notionhq/client'
import { isFullBlock } from '@notionhq/client'
import { omit } from 'es-toolkit'
import { v4 as uuidv4 } from 'uuid'
import { createNotionFetch, validateStartCursor } from '~~/server/lib'

/**
 * Group the block list into a group block if the
 * block type is the same as the previous block
 */
function groupBlock(beginIndex: number, blockList: BlockObjectResponse[]): {
  endIndex: number
  group: (BlockResponse & { type: 'group' })
} {
  const blockElementType = blockList[beginIndex].type
  let endIndex = beginIndex
  while (endIndex < blockList.length && blockList[endIndex].type === blockElementType) {
    endIndex++
  }
  return {
    endIndex,
    group: {
      type: 'group',
      block_list: blockList.slice(beginIndex, endIndex),
      id: uuidv4(),
    },
  }
}

/**
 * Parse the block list into a block response list.
 * This funciton will group list items into a group block for frontend to
 * render the list items into a single parent element.
 */
function parseBlockList(results: ListBlockChildrenResponse['results']): BlockResponse[] {
  const blockObjects = results.filter(isFullBlock)
  const blocks: BlockResponse[] = []
  let index = 0
  while (index < blockObjects.length) {
    if (blockObjects[index].type === 'bulleted_list_item' || blockObjects[index].type === 'numbered_list_item') {
      const { endIndex, group } = groupBlock(index, blockObjects)
      blocks.push(group)
      index = endIndex
    }
    else {
      blocks.push({
        type: 'single',
        block: blockObjects[index],
        id: uuidv4(),
      })
      index++
    }
  }
  return blocks
}

export default defineCachedEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (typeof id !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'id must be a string',
    })
  }
  const start_cursor = validateStartCursor(getQuery(event).start_cursor)
  const notionFetch = await createNotionFetch(event)
  const response = await notionFetch<ListBlockChildrenResponse>(
    `/blocks/${id}/children`,
    {
      params: {
        start_cursor,
      },
    },
  )
  const metadata = omit(response, ['results'])
  const { results } = response
  const blocks = parseBlockList(results)
  return {
    ...metadata,
    blocks,
  } as BlockChildrenResponse
}, {
  maxAge: 60 * 5,
})
