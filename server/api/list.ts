import type { MultiSelectPropertyItemObjectResponse, QueryDataSourceResponse } from '@notionhq/client'
import { isFullPage } from '@notionhq/client'
import z from 'zod'

import { createNotionFetch, validateQueryParam, validateUUID } from '~~/server/lib'

interface BuildResultOptions {
  tag?: string
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

export default defineCachedEventHandler(async (event) => {
  const runtimeConfig = useRuntimeConfig(event)
  const startCursor = validateUUID(getQuery(event).start_cursor)
  const tag = runtimeConfig.notion.fields.tag !== '' ? validateQueryParam(getQuery(event).tag, 'tag', z.string()) : undefined
  const tagOption = tag !== undefined ? await buildTagOption(runtimeConfig.notion.fields.tag, tag) : undefined
  const notionFetch = await createNotionFetch(event)
  const response = await notionFetch<QueryDataSourceResponse>(`/data_sources/${runtimeConfig.notion.datasourceId}/query`, {
    body: {
      start_cursor: startCursor,
      sorts: [
        {
          timestamp: 'created_time',
          direction: 'descending',
        },
      ],
      filter: tagOption?.filter,
    },
    method: 'POST',
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
