import type {
  BlockObjectResponse,
  GetDataSourceResponse,
  ListBlockChildrenResponse,
  MultiSelectPropertyItemObjectResponse,
  PageObjectResponse,
  QueryDataSourceResponse,
  UserObjectResponse,
} from '@notionhq/client'
import { isFullBlock, isFullPage } from '@notionhq/client'
import { getBlogConfig } from '@/lib/config'
import { buildNotionRestCacheKey, withNotionCache } from '@/lib/notion/cache'

const NOTION_VERSION = '2025-09-03'

/**
 *
 */
function getHeaders() {
  const { token } = getBlogConfig().notion
  return {
    'Authorization': `Bearer ${token}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  }
}

/**
 *
 */
async function notionFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method ?? 'GET'
  const body = typeof init?.body === 'string' ? init.body : ''
  const key = buildNotionRestCacheKey(method, path, body)

  return withNotionCache(key, async () => {
    const res = await fetch(`https://api.notion.com/v1${path}`, {
      ...init,
      headers: {
        ...getHeaders(),
        ...init?.headers,
      },
    })
    if (!res.ok) {
      throw new Error(`Notion API ${res.status}: ${await res.text()}`)
    }
    return res.json()
  })
}

/**
 *
 */
export async function queryDataSource(body: Record<string, unknown>) {
  const { datasourceId } = getBlogConfig().notion
  return notionFetch<QueryDataSourceResponse>(`/data_sources/${datasourceId}/query`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/**
 *
 */
export async function getDataSource() {
  const { datasourceId } = getBlogConfig().notion
  return notionFetch<GetDataSourceResponse>(`/data_sources/${datasourceId}`)
}

/**
 *
 */
export async function getPage(id: string) {
  return notionFetch<PageObjectResponse>(`/pages/${id}`)
}

/**
 *
 */
export async function getUser(id: string) {
  return notionFetch<UserObjectResponse>(`/users/${id}`)
}

/**
 *
 */
export async function getBlockChildren(id: string) {
  return notionFetch<ListBlockChildrenResponse>(`/blocks/${id}/children`)
}

/**
 *
 */
export async function getTags() {
  const config = getBlogConfig()
  const tagKey = config.notion.fields.tag
  const dataSourceResponse = await getDataSource()

  if (
    tagKey === ''
    || dataSourceResponse.properties[tagKey] === undefined
    || dataSourceResponse.properties[tagKey].type !== 'multi_select'
  ) {
    return []
  }

  return dataSourceResponse.properties[tagKey].multi_select.options
}

/**
 *
 */
export async function getPageSummary(id: string): Promise<string> {
  const response = await getBlockChildren(id)
  const list: string[] = []

  for (const blockItem of response.results.filter(isFullBlock)) {
    if (blockItem.type === 'paragraph') {
      list.push(blockItem.paragraph.rich_text.map(text => text.plain_text).join(' '))
    }
    if (blockItem.type === 'divider') {
      break
    }
  }

  return list.join(' ').slice(0, 10000)
}

/**
 *
 */
export function extractTitle(page: PageObjectResponse): string {
  if (!isFullPage(page))
    return ''
  const titleProperty = Object.values(page.properties).find(p => p.type === 'title')
  return titleProperty?.type === 'title'
    ? titleProperty.title.map(t => t.plain_text).join('')
    : ''
}

/**
 *
 */
export function extractCover(page: PageObjectResponse): string | null {
  if (!isFullPage(page) || page.cover === null)
    return null
  return page.cover.type === 'external' ? page.cover.external.url : page.cover.file.url
}

/**
 *
 */
export function extractTags(
  page: PageObjectResponse,
  tagField: string,
): MultiSelectPropertyItemObjectResponse['multi_select'] {
  if (!isFullPage(page) || !tagField)
    return []
  const prop = page.properties[tagField]
  return prop?.type === 'multi_select' ? prop.multi_select : []
}

export type { BlockObjectResponse, PageObjectResponse }
