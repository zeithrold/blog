import type {
  MultiSelectPropertyItemObjectResponse,
  QueryDataSourceResponse,
} from '@notionhq/client'
import type { EventHandlerRequest, H3Event } from 'h3'
import { isFullPage } from '@notionhq/client'
import z from 'zod'

import { createNotionFetch, validateQueryParam, validateUUID } from '~~/server/lib'

interface BuildResultOptions {
  tag?: string
}

interface MultiSelectFilter {
  property: string
  multi_select: {
    contains: string
  }
}

/**
 * Build tag option
 */
async function buildTagOption(property: string, name: string) {
  const { tags } = await $fetch('/api/tags')
  const foundTag = tags.find(item => item.name === name)
  if (!foundTag) {
    return undefined
  }
  return {
    tag: foundTag,
    filter: {
      property,
      multi_select: {
        contains: foundTag.name,
      },
    },
  }
}

/**
 * Build result
 */
async function buildResult(response: QueryDataSourceResponse, { tag }: BuildResultOptions) {
  const pageList = response.results.filter(item => item.object === 'page' && isFullPage(item))
  return Promise.all(pageList.map(async (page) => {
    const { summary } = await $fetch(`/api/summary/${page.id}`)
    const title = Object.values(page.properties).find(item => item.type === 'title')!.title.map(item => item.plain_text).join('')
    const cover = page.cover === null ? null : page.cover.type === 'external' ? page.cover.external.url : page.cover.file.url
    const author = await $fetch(`/api/user/${page.created_by.id}`)
    const { id, created_time } = page
    const tags = Object
      .entries(page.properties)
      .filter(([
        key,
        value,
      ]) => key === tag && value.type === 'multi_select')
      .map(([
        _,
        value,
      ]) => {
        return (value as MultiSelectPropertyItemObjectResponse).multi_select
      })
      .flat()
    return {
      id,
      title,
      cover,
      author,
      created_time,
      tags,
      summary,
    }
  }))
}

/**
 * Build fetch body for Notion API
 */
function buildFetchBody(startCursor: string | undefined, tagFilter: MultiSelectFilter | undefined) {
  return {
    start_cursor: startCursor,
    sorts: [
      {
        timestamp: 'created_time',
        direction: 'descending',
      },
    ],
    filter: tagFilter,
  }
}

/**
 * Validate tag parameter and build tag option
 */
async function validateAndBuildTagOption(tag: string | undefined, tagField: string) {
  if (tag === undefined) {
    return undefined
  }

  const tagOption = await buildTagOption(tagField, tag)
  if (tagOption === undefined) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Tag not found',
    })
  }

  return tagOption
}

export interface FetchNotionDataOptions {
  startCursor: string | undefined
  tagFilter: MultiSelectFilter | undefined
  datasourceId: string
  event: H3Event<EventHandlerRequest>
}

/**
 * Fetch data from Notion API
 */
async function fetchNotionData({ event, startCursor, tagFilter, datasourceId }: FetchNotionDataOptions) {
  const notionFetch = await createNotionFetch(event)
  return notionFetch<QueryDataSourceResponse>(`/data_sources/${datasourceId}/query`, {
    body: buildFetchBody(startCursor, tagFilter),
    method: 'POST',
  })
}

export default defineCachedEventHandler(async (event) => {
  const runtimeConfig = useRuntimeConfig(event)
  const startCursor = validateUUID(getQuery(event).start_cursor)
  const tag = runtimeConfig.notion.fields.tag !== '' ? validateQueryParam(getQuery(event).tag, 'tag', z.string()) : undefined
  const tagOption = await validateAndBuildTagOption(tag, runtimeConfig.notion.fields.tag)
  const response = await fetchNotionData({
    event,
    startCursor,
    tagFilter: tagOption?.filter,
    datasourceId: runtimeConfig.notion.datasourceId,
  })
  const result = await buildResult(response, { tag: runtimeConfig.notion.fields.tag })

  return {
    pages: result,
    next_cursor: response.next_cursor,
    has_more: response.has_more,
    tag: tagOption?.tag,
  }
}, {
  maxAge: 60 * 5,
  swr: false,
})
