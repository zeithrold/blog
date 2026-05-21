import type { QueryDataSourceResponse } from '@notionhq/client'
import type { ListResponse, PageMeta, PartialSelectResponse } from '@/lib/types/posts'
import { isFullPage } from '@notionhq/client'
import { getBlogConfig } from '@/lib/config'
import {
  extractCover,
  extractTags,
  extractTitle,
  getPage,
  getPageSummary,
  getTags,
  getUser,
  queryDataSource,
} from './official'

interface MultiSelectFilter {
  property: string
  multi_select: { contains: string }
}

interface CheckboxFilter {
  property: string
  checkbox: { does_not_equal: boolean }
}

type FilterList = (MultiSelectFilter | CheckboxFilter)[]

/**
 *
 */
async function buildTagOption(tagField: string, name: string) {
  const tags = await getTags()
  const foundTag = tags.find(item => item.name === name)
  if (!foundTag)
    return undefined
  return {
    tag: foundTag as PartialSelectResponse,
    filter: {
      property: tagField,
      multi_select: { contains: foundTag.name },
    },
  }
}

/**
 *
 */
function buildDraftFilter(draftField: string | undefined): CheckboxFilter | undefined {
  if (draftField == null || draftField === '')
    return undefined
  return {
    property: draftField,
    checkbox: { does_not_equal: true },
  }
}

/**
 *
 */
async function buildFilterList(tag?: string) {
  const config = getBlogConfig().notion
  const tagOption = tag != null && tag !== ''
    ? await buildTagOption(config.fields.tag, tag)
    : undefined
  const draftFilter = buildDraftFilter(config.fields.draft)
  const filterList = [
    tagOption?.filter,
    draftFilter,
  ].filter(Boolean) as FilterList
  return { filterList, tag: tagOption?.tag }
}

/**
 *
 */
function buildFetchBody(startCursor: string | undefined, filterList: FilterList) {
  return {
    start_cursor: startCursor,
    sorts: [{ timestamp: 'created_time', direction: 'descending' as const }],
    filter: filterList.length === 0
      ? undefined
      : filterList.length === 1
        ? filterList[0]
        : { and: filterList },
  }
}

/**
 *
 */
async function buildResult(
  response: QueryDataSourceResponse,
  tagField: string,
  activeTag?: PartialSelectResponse,
) {
  const pageList = response.results.filter(
    item => item.object === 'page' && isFullPage(item),
  )

  const pages = await Promise.all(
    pageList.map(async (page) => {
      const summary = await getPageSummary(page.id)
      const title = extractTitle(page)
      const cover = extractCover(page)
      const author = await getUser(page.created_by.id)
      const tags = extractTags(page, tagField)

      return {
        id: page.id,
        title,
        cover,
        author,
        created_time: page.created_time,
        tags,
        summary,
      }
    }),
  )

  return {
    pages,
    next_cursor: response.next_cursor,
    has_more: response.has_more,
    tag: activeTag,
  }
}

/**
 *
 */
export async function fetchPosts(options?: {
  tag?: string
  startCursor?: string
}): Promise<ListResponse> {
  const config = getBlogConfig().notion
  const { filterList, tag } = await buildFilterList(options?.tag)
  const response = await queryDataSource(
    buildFetchBody(options?.startCursor, filterList),
  )
  return buildResult(response, config.fields.tag, tag)
}

/**
 *
 */
export async function getPageMeta(pageId: string): Promise<PageMeta> {
  const config = getBlogConfig().notion
  const page = await getPage(pageId)
  const author = await getUser(page.created_by.id)

  return {
    id: page.id,
    title: extractTitle(page),
    cover: extractCover(page),
    created_time: page.created_time,
    author,
    tags: extractTags(page, config.fields.tag),
  }
}

/**
 *
 */
export async function checkHealth(): Promise<{ status: 'healthy', records: number } | { status: 'unhealthy' }> {
  try {
    getBlogConfig()
    const response = await queryDataSource({ page_size: 1 })
    return { status: 'healthy', records: response.results.length }
  }
  catch {
    return { status: 'unhealthy' }
  }
}
