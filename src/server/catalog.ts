import type { z } from 'zod'
import type { catalogCreateSchema, catalogUpdateSchema } from '@/content/service-contracts'
import type { Mutation } from '@/server/repository-types'
import { catalogItemSchema } from '@/content/service-contracts'
import { Problem } from '@/server/problem'
import { RepositoryCore } from '@/server/repository-core'

type Kind = 'tag' | 'series'
export class CatalogRepository extends RepositoryCore {
  async list(kind: Kind): Promise<{
    items: z.infer<typeof catalogItemSchema>[]
  }> {
    const result = await this.sql(
      `SELECT id,kind,slug,label AS name,version,retired FROM catalog WHERE kind=? ORDER BY
label,id LIMIT 1000`,
      kind,
    ).all<{
      id: string
      kind: Kind
      slug: string
      name: string
      version: number
      retired: number
    }>()
    return {
      items: result.results.map(item => ({
        ...item,
        retired: item.retired === 1,
      })),
    }
  }

  async create(
    kind: Kind,
    input: z.infer<typeof catalogCreateSchema>,
    mutation: Mutation,
  ): Promise<z.infer<typeof catalogItemSchema>> {
    const replay = await this.replayAs(mutation, catalogItemSchema)
    if (replay !== null) {
      return replay
    }
    const count = await this.sql(
      'SELECT COUNT(*) AS count FROM catalog WHERE kind=?',
      kind,
    ).first<{
      count: number
    }>()
    if ((count?.count ?? 0) >= 1000) {
      throw new Problem(422, 'CATALOG_LIMIT')
    }
    const now = Date.now()
    const response = {
      id: crypto.randomUUID(),
      kind,
      ...input,
      version: 0,
      retired: false,
    }
    await this.commit(
      [
        this.writableGuard(mutation, '(SELECT COUNT(*) FROM catalog WHERE kind=?)<1000', [kind]),
        this.sql(
          'INSERT INTO catalog(id,kind,slug,label,created_at,updated_at) VALUES(?,?,?,?,?,?)',
          response.id,
          kind,
          input.slug,
          input.name,
          now,
          now,
        ),
        this.journal({
          mutation,
          id: null,
          operation: 'catalog.create',
          response,
          now,
        }),
        this.end(mutation),
      ],
      mutation,
    )
    return (await this.replayAs(mutation, catalogItemSchema)) ?? response
  }

  async update(
    kind: Kind,
    id: string,
    input: z.infer<typeof catalogUpdateSchema>,
    mutation: Mutation,
  ): Promise<z.infer<typeof catalogItemSchema>> {
    const replay = await this.replayAs(mutation, catalogItemSchema)
    if (replay !== null) {
      return replay
    }
    const now = Date.now()
    const response = {
      id,
      kind,
      slug: input.slug,
      name: input.name,
      version: input.expectedVersion + 1,
      retired: input.retired,
    }
    await this.commit(
      [
        this.writableGuard(
          mutation,
          'EXISTS(SELECT 1 FROM catalog WHERE id=? AND kind=? AND version=?)',
          [
            id,
            kind,
            input.expectedVersion,
          ],
        ),
        this.sql(
          'UPDATE catalog SET slug=?,label=?,retired=?,version=version+1,updated_at=? WHERE id=?',
          input.slug,
          input.name,
          input.retired ? 1 : 0,
          now,
          id,
        ),
        this.journal({
          mutation,
          id: null,
          operation: 'catalog.update',
          response,
          now,
        }),
        this.end(mutation),
      ],
      mutation,
    )
    return (await this.replayAs(mutation, catalogItemSchema)) ?? response
  }
}
