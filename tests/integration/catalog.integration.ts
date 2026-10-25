import type { Runtime } from '~/tests/support/worker/runtime'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { catalogItemSchema, catalogListSchema } from '@/contracts/catalog'
import { deepEqual, equal } from '~/tests/support/unit/assertions'
import { json, refusal } from '~/tests/support/worker/responses'
import { runtime } from '~/tests/support/worker/runtime'

type Kind = 'series' | 'tag'
const path = '/api/admin/catalog'

async function create(
  context: Runtime,
  kind: Kind,
  name: string,
  slug = `catalog-${crypto.randomUUID()}`,
) {
  return await json(
    await context.write(`${path}/${kind}`, { name, slug }),
    201,
    catalogItemSchema,
  )
}
async function list(context: Runtime, kind: Kind) {
  return await json(await context.fetch(`${path}/${kind}`), 200, catalogListSchema)
}
async function rows(context: Runtime, kind: Kind): Promise<number> {
  const row = await context.db
    .prepare('SELECT COUNT(*) AS n FROM catalog WHERE kind=?')
    .bind(kind)
    .first<{ n: number }>()
  assert.ok(row !== null)
  return row.n
}

// Tags and series share one table, one schema and one repository, so the only thing that keeps
// them apart is the kind predicate: a list or an update that ignores it silently merges two
// catalogs that the admin surface renders as unrelated pages.
test('catalog lists stay scoped to one kind and keep their label order', async () => {
  const context = await runtime()
  try {
    const zulu = await create(context, 'tag', 'Zulu', 'shared-slug')
    const alpha = await create(context, 'tag', 'Alpha')
    // The unique key is (kind,slug), so the other catalog may reuse the slug without touching this one.
    const series = await create(context, 'series', 'Alpha', 'shared-slug')
    equal(zulu.version, 0)
    equal(zulu.retired, false)
    deepEqual(await list(context, 'tag'), {
      items: [alpha, zulu],
    })
    deepEqual(await list(context, 'series'), { items: [series] })
    // A kind outside the two the API serves is a missing route, not an unfiltered list.
    equal(await refusal(await context.fetch(`${path}/video`), 404), 'NOT_FOUND')
  }
  finally {
    await context.dispose()
  }
}).catch((error: unknown) => { throw error })

// Every catalog write is a mutation, so it must meet the same owner, origin and CSRF gate that
// document writes meet, and it must refuse a body the browser never builds before touching a row.
test('catalog writes require the document owner, origin and CSRF gate', async () => {
  const context = await runtime()
  try {
    const anonymous = await context.fixture.dispatchFetch(`${context.origin}${path}/tag`)
    equal(await refusal(anonymous, 401), 'AUTH_REQUIRED')
    const body = JSON.stringify({ name: 'Unauthorized', slug: 'unauthorized' })
    const withoutToken = await context.fetch(`${path}/tag`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'origin': context.origin },
      body,
    })
    equal(await refusal(withoutToken, 403), 'CSRF_INVALID')
    const foreignOrigin = await context.fetch(`${path}/tag`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': crypto.randomUUID(),
        'origin': 'https://evil.test',
        'x-csrf-token': context.csrfToken,
      },
      body,
    })
    equal(await refusal(foreignOrigin, 403), 'ORIGIN_INVALID')
    equal(await rows(context, 'tag'), 0)
    const tag = await create(context, 'tag', 'Validated')
    const refusals = [
      { method: 'POST', url: `${path}/tag`, body: { name: 'Unknown field', slug: 'unknown-field', kind: 'tag' } },
      { method: 'POST', url: `${path}/tag`, body: { name: 'Missing slug' } },
      {
        method: 'PUT',
        url: `${path}/tag/${tag.id}`,
        body: { name: 'Negative version', slug: 'negative', retired: false, expectedVersion: -1 },
      },
      {
        method: 'PUT',
        url: `${path}/tag/${tag.id}`,
        body: { name: 'Missing retired', slug: 'missing-retired', expectedVersion: 0 },
      },
    ]
    for (const invalid of refusals) {
      equal(
        await refusal(await context.write(invalid.url, invalid.body, invalid.method), 400),
        'INVALID_REQUEST',
      )
    }
    deepEqual(await list(context, 'tag'), { items: [tag] })
  }
  finally {
    await context.dispose()
  }
}).catch((error: unknown) => { throw error })

// A catalog save that reaches the journal twice must not add a second entry, and a reused key with
// a different body must be refused rather than answered with the first entry's acknowledgement.
test('catalog creation replays one entry per idempotency key and refuses its reuse', async () => {
  const context = await runtime()
  try {
    const key = crypto.randomUUID()
    const body = { name: 'Replayed', slug: `replayed-${crypto.randomUUID()}` }
    const first = await json(await context.write(`${path}/tag`, body, 'POST', key), 201, catalogItemSchema)
    deepEqual(
      await json(await context.write(`${path}/tag`, body, 'POST', key), 201, catalogItemSchema),
      first,
    )
    equal(await rows(context, 'tag'), 1)
    equal(
      await refusal(await context.write(`${path}/tag`, { ...body, name: 'Other body' }, 'POST', key), 409),
      'IDEMPOTENCY_KEY_REUSED',
    )
    // The slug is unique per kind, so a second entry of the same kind cannot take it.
    equal(
      await refusal(await context.write(`${path}/tag`, { name: 'Duplicate slug', slug: body.slug }), 409),
      'PUBLICATION_CONFLICT',
    )
    equal(await rows(context, 'tag'), 1)
    equal((await create(context, 'series', 'Replayed', body.slug)).kind, 'series')
  }
  finally {
    await context.dispose()
  }
}).catch((error: unknown) => { throw error })

// An update is version-guarded inside its own kind, and maintenance pauses writes without hiding
// the catalog an editor still needs to read.
test('catalog updates are version-guarded per kind and maintenance only pauses writes', async () => {
  const context = await runtime()
  try {
    const tag = await create(context, 'tag', 'Guarded')
    const key = crypto.randomUUID()
    const update = {
      name: 'Guarded renamed',
      slug: `renamed-${crypto.randomUUID()}`,
      retired: true,
      expectedVersion: tag.version,
    }
    const saved = await json(
      await context.write(`${path}/tag/${tag.id}`, update, 'PUT', key),
      200,
      catalogItemSchema,
    )
    equal(saved.version, tag.version + 1)
    equal(saved.retired, true)
    deepEqual(
      await json(await context.write(`${path}/tag/${tag.id}`, update, 'PUT', key), 200, catalogItemSchema),
      saved,
    )
    equal(
      await refusal(
        await context.write(`${path}/tag/${tag.id}`, { ...update, expectedVersion: tag.version }, 'PUT'),
        409,
      ),
      'EDIT_CONFLICT',
    )
    // The same id under the other kind is a different catalog, so it cannot be updated there.
    equal(
      await refusal(
        await context.write(`${path}/series/${tag.id}`, { ...update, expectedVersion: saved.version }, 'PUT'),
        409,
      ),
      'EDIT_CONFLICT',
    )
    deepEqual(await list(context, 'tag'), { items: [saved] })
    await context.db.prepare('UPDATE site_state SET maintenance=1 WHERE id=1').run()
    try {
      equal(
        await refusal(await context.write(`${path}/tag`, { name: 'Paused', slug: 'paused' }), 503),
        'MAINTENANCE',
      )
      equal(
        await refusal(
          await context.write(`${path}/tag/${tag.id}`, { ...update, expectedVersion: saved.version }, 'PUT'),
          503,
        ),
        'MAINTENANCE',
      )
      deepEqual(await list(context, 'tag'), { items: [saved] })
    }
    finally {
      await context.db.prepare('UPDATE site_state SET maintenance=0 WHERE id=1').run()
    }
  }
  finally {
    await context.dispose()
  }
}).catch((error: unknown) => { throw error })
