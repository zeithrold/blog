import type { Mutation } from '@/server/documents/repository-types'
import type { Environment } from '@/server/runtime/environment'
import { UUID } from '@/content/document'
import { catalogCreateSchema, catalogKindSchema, catalogUpdateSchema } from '@/contracts/catalog'
import { allocateAssetSchema } from '@/contracts/media'
import { resumeInputSchema } from '@/contracts/operations'
import { CatalogRepository } from '@/server/catalog/catalog'
import { cursor, parse, respond } from '@/server/http/api-contracts'
import { Problem } from '@/server/http/problem'
import { AssetContent } from '@/server/media/asset-content'
import { AssetUpload } from '@/server/media/asset-upload'
import { finishBackupSchema, Operations } from '@/server/operations/operations'
import { timeChoices } from '@/server/publication/schedule-time'
import { referenceMetadata } from '@/server/references/reference-metadata'

export async function readServices(request: Request, env: Environment): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname
  if (path === '/api/admin/reference-metadata' && request.method === 'GET') {
    return respond(await referenceMetadata(url.searchParams.get('doi') ?? ''))
  }
  if (path === '/api/admin/assets') {
    return respond(
      await new AssetUpload(env.DB, env.MEDIA).listAssets(
        cursor(url.searchParams.get('cursor')),
      ),
    )
  }
  const asset = /^\/api\/admin\/assets\/([^/]+)(\/content)?$/.exec(path)
  if (asset?.[1] !== undefined) {
    const id = parse(UUID, asset[1])
    return asset[2] === undefined
      ? respond(await new AssetUpload(env.DB, env.MEDIA).status(id))
      : await new AssetContent(env.DB).serve(request, id, env.MEDIA, true)
  }
  return await readCatalog(url, env)
}
async function readCatalog(url: URL, env: Environment): Promise<Response> {
  const path = url.pathname
  const catalog = /^\/api\/admin\/catalog\/(tag|series)$/.exec(path)
  if (catalog?.[1] !== undefined) {
    return respond(
      await new CatalogRepository(env.DB).list(parse(catalogKindSchema, catalog[1])),
    )
  }
  if (path === '/api/admin/schedule-times' || path === '/api/admin/schedule-time') {
    return respond({
      choices: timeChoices(
        url.searchParams.get('localTime') ?? '',
        url.searchParams.get('timezone') ?? '',
      ),
    })
  }
  return await readOperations(url, env)
}
async function readOperations(url: URL, env: Environment): Promise<Response> {
  const operations = new Operations(env.DB)
  if (url.pathname === '/api/admin/operations') {
    return respond(await operations.health())
  }
  const backup = /^\/api\/admin\/backups\/([^/]+)\/(rows|manifest|assets\/([^/]+))$/.exec(
    url.pathname,
  )
  if (backup?.[1] === undefined) {
    throw new Problem(404, 'NOT_FOUND')
  }
  const id = parse(UUID, backup[1])
  if (backup[2] === 'rows') {
    return respond(
      await operations.page(
        id,
        url.searchParams.get('table') ?? '',
        Number(url.searchParams.get('after') ?? 0),
      ),
    )
  }
  if (backup[2] === 'manifest') {
    return respond(await operations.manifest(id, url.searchParams.get('after') ?? ''))
  }
  await operations.frozen(id)
  const assetId = parse(UUID, backup[3])
  // All ready assets are pinned by the freeze transaction, including those used only by history.
  return await new AssetContent(env.DB).serve(
    new Request(url.origin, {
      method: 'GET',
    }),
    assetId,
    env.MEDIA,
    true,
  )
}
export async function writeServices(
  request: Request,
  env: Environment,
  body: unknown,
  mutation: Mutation,
): Promise<Response> {
  const path = new URL(request.url).pathname
  const assets = new AssetUpload(env.DB, env.MEDIA)
  if (path === '/api/admin/assets' && request.method === 'POST') {
    return respond(await assets.allocate(parse(allocateAssetSchema, body), mutation), 201)
  }
  return await writeCatalog(request, env, body, mutation)
}
async function writeCatalog(
  request: Request,
  env: Environment,
  body: unknown,
  mutation: Mutation,
): Promise<Response> {
  const path = new URL(request.url).pathname
  const catalog = /^\/api\/admin\/catalog\/(tag|series)(?:\/([^/]+))?$/.exec(path)
  if (catalog?.[1] !== undefined) {
    const repository = new CatalogRepository(env.DB)
    const kind = parse(catalogKindSchema, catalog[1])
    if (catalog[2] === undefined && request.method === 'POST') {
      return respond(
        await repository.create(kind, parse(catalogCreateSchema, body), mutation),
        201,
      )
    }
    if (catalog[2] !== undefined && request.method === 'PUT') {
      return respond(
        await repository.update(
          kind,
          parse(UUID, catalog[2]),
          parse(catalogUpdateSchema, body),
          mutation,
        ),
      )
    }
  }
  return await writeOperations(request, env, body, mutation)
}
async function writeOperations(
  request: Request,
  env: Environment,
  body: unknown,
  mutation: Mutation,
): Promise<Response> {
  const path = new URL(request.url).pathname
  const operations = new Operations(env.DB)
  if (path === '/api/admin/operations/resume' && request.method === 'POST') {
    return respond(
      await operations.resume(parse(resumeInputSchema, body).expectedGeneration, mutation),
    )
  }
  if (path === '/api/admin/backups/freeze' && request.method === 'POST') {
    return respond(await operations.freeze(mutation), 201)
  }
  if (path === '/api/admin/backups/finish' && request.method === 'POST') {
    return respond(await operations.finish(parse(finishBackupSchema, body), mutation))
  }
  throw new Problem(404, 'NOT_FOUND')
}
