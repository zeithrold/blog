import type { Client } from '@notionhq/client'
import type { StoredBlock } from './block-shape'
import type { PublicItem, PublicPath } from '@/contracts/notion'
import { nextCursor, NotionContentError, pagination } from './api'
import { blockSchema } from './block-shape'
import { convertBlocks } from './blocks'

export async function fetchBlocks(
  client: Client,
  item: PublicItem,
  links: Readonly<Record<string, PublicPath>>,
): Promise<StoredBlock[]> {
  const blocks: StoredBlock[] = []
  const visited = new Set<string>([item.id])
  async function children(parentId: string): Promise<string[]> {
    const ids: string[] = []
    const seen = new Set<string>()
    let cursor: string | null = null
    do {
      const result = pagination(await client.blocks.children.list({
        block_id: parentId,
        ...(cursor !== null ? { start_cursor: cursor } : {}),
      }))
      for (const raw of result.results) {
        const block = blockSchema.parse(raw)
        convertBlocks(item, [
          { block, parentId, children: [] },
        ], links)
        if (visited.has(block.id)) {
          throw new NotionContentError('Repeated block in page body')
        }
        visited.add(block.id)
        ids.push(block.id)
        blocks.push({ block, parentId, children: block.has_children ? await children(block.id) : [] })
      }
      cursor = nextCursor(result.next_cursor, seen)
    } while (cursor !== null)
    return ids
  }
  await children(item.id)
  return blocks
}
