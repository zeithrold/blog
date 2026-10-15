import type { Document } from '@/content/envelope'
import { ContentError } from '@/content/base'
import { allBlocks, MEDIA_TYPES } from '@/content/tree'

export type AssetRole = 'image' | 'audio' | 'video' | 'file' | 'caption' | 'poster'
export type AssetReference = {
  assetId: string
  role: AssetRole
}

export function assetReferences(document: Document): AssetReference[] {
  const found = new Map<string, AssetReference>()
  function add(assetId: string, role: AssetRole): void {
    found.set(`${assetId}:${role}`, {
      assetId,
      role,
    })
  }
  for (const { block } of allBlocks(document.blocks)) {
    if (!MEDIA_TYPES.has(block.type)) {
      continue
    }
    const url = block.props.url
    if (typeof url === 'string' && url !== '') {
      add(url.slice('/assets/'.length), mediaRole(block.type))
    }
    for (const reference of accessoryReferences(document.mediaAccessibility[block.id])) {
      add(reference.assetId, reference.role)
    }
  }
  if (found.size > 128) {
    throw new ContentError('ASSET_REFERENCE_LIMIT')
  }
  return Array.from(found.values())
}

function mediaRole(type: string): AssetRole {
  if (type === 'image' || type === 'video' || type === 'audio' || type === 'file') {
    return type
  }
  throw new ContentError('ASSET_ROLE_INVALID')
}

function accessoryReferences(
  value: Document['mediaAccessibility'][string] | undefined,
): AssetReference[] {
  if (value === undefined) {
    return []
  }
  const result: AssetReference[] = []
  if (value.captionAssetId !== null) {
    result.push({ assetId: value.captionAssetId, role: 'caption' })
  }
  if (value.posterAssetId !== null) {
    result.push({ assetId: value.posterAssetId, role: 'poster' })
  }
  return result
}
