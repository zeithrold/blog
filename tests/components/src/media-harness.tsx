import type { ReactNode } from 'react'
import { MediaEntry } from '@/features/media/media-entry'
import { COMPONENT_TEST_FIXTURES } from './fixtures'

/**
 * The gallery page's own client surface: the entry check, the retained gallery
 * session and everything the media manager renders from it. Media-only, so a
 * second domain's surfaces never share this file.
 */
export function MediaGallerySurface(): ReactNode {
  return <MediaEntry owner={COMPONENT_TEST_FIXTURES.owner} />
}
