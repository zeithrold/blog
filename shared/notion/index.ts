import type { BlockObjectResponse, ListBlockChildrenResponse } from '@notionhq/client'

export interface GroupBlockResponse {
  type: 'group'
  block_list: BlockObjectResponse[]
}

export interface SingleBlockResponse {
  type: 'single'
  block: BlockObjectResponse
}

export type BlockResponse = (GroupBlockResponse | SingleBlockResponse) & {
  id: string
}
export type BlockChildrenMetadata = Omit<ListBlockChildrenResponse, 'results'>

export interface BlockChildrenResponse extends BlockChildrenMetadata {
  blocks: BlockResponse[]
}
