import type { PublicPath } from '@/contracts/notion'
import { env } from 'cloudflare:workers'
import { cache } from 'react'
import { readCatalog } from '@/server/notion/catalog'
import { readPage } from '@/server/notion/page'

export const publishedCatalog = cache(async () => await readCatalog(env))
export const publicPage = cache(async (path: PublicPath) => await readPage(env, path))
