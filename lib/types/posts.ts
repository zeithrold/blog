import type { UserObjectResponse } from '@notionhq/client'

export type SelectColor = 'default' | 'gray' | 'brown' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink' | 'red'

export interface PartialSelectResponse {
  id: string
  name: string
  color: SelectColor
}

export interface PageItem {
  id: string
  title: string
  cover: string | null
  author: UserObjectResponse
  created_time: string
  tags: PartialSelectResponse[]
  summary: string
}

export interface ListResponse {
  pages: PageItem[]
  next_cursor: string | null
  has_more: boolean
  tag: PartialSelectResponse | undefined
}

export interface PageMeta {
  id: string
  title: string
  cover: string | null
  created_time: string
  author: UserObjectResponse
  tags: PartialSelectResponse[]
}
